import { FastifyReply, FastifyRequest } from "fastify";
import prisma from "@libs/prisma";
import logger from "@libs/logger";
import {
  RedisAddList,
  RedisClearKey,
  RedisClearKeyByPattern,
  RedisGetJson,
  RedisGetList,
  RedisRemoveFromList,
  RedisSetTTL,
} from "@libs/redis";
import session from "@utils/session";
import {
  Post,
  CreatePostProps,
  GetParamsID,
  LikePostProps,
  UpdatePostProps,
} from "@entities/post";
import { paginationProps } from "@modules/pagination";
import { followingIds, invalidateUserCache } from "./user";
import { PaginationProps } from "@entities/pagination";

export async function createPost(
  request: FastifyRequest<CreatePostProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { image, content } = request.body;
    const me = await session(authorization);

    if (!image) {
      return reply.code(400).send({ message: `Image is required.` });
    }

    await prisma.post.create({
      data: {
        userId: me.id,
        image,
        content,
      },
    });

    await invalidateExploreCache();
    await invalidateUserCache(me.id);

    return reply.code(201).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getPost(
  request: FastifyRequest<GetParamsID>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const totalLikes = (await postLikesIds(id)) ?? [];

    const cacheKey = "post:" + id + ":detail";
    const cachedPost = await RedisGetJson<{ data: Post }>(cacheKey);
    if (cachedPost) {
      return {
        data: { ...cachedPost.data, total_likes: totalLikes.length },
      };
    }

    const post = await prisma.post.findUnique({
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      where: {
        id: parseInt(id) || 0,
      },
    });

    if (!post) {
      return reply.code(404).send({ message: `Post not found.` });
    }

    await RedisSetTTL(cacheKey, { data: post }, 86400); // 1 day in seconds.

    return reply.code(200).send({
      data: { ...post, total_likes: totalLikes.length },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getLikedPostsByMe(
  request: FastifyRequest,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const user = await session(authorization);
    const likes = await userLikedPostsIds(user.id);

    return reply.code(200).send({
      data: likes,
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getUserPosts(
  request: FastifyRequest<PaginationProps<GetParamsID>>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    if (!id) {
      return reply.code(400).send({ message: `UserID is required.` });
    }

    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    const user = await prisma.user.findUnique({
      select: { id: true },
      where: { id: parseInt(id) || 0 },
    });

    if (!user) {
      return reply.code(404).send({ message: `User not found.` });
    }

    const ct = await prisma.post.count({
      where: { userId: user.id },
    });

    const posts = await prisma.post.findMany({
      take,
      skip,
      where: { userId: user.id },
    });

    for (const p of posts as Post[]) {
      const totalLikes = (await postLikesIds(p.id)) ?? [];
      p.total_likes = totalLikes.length;
    }

    return reply.code(200).send({
      ct,
      data: posts,
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function updatePost(
  request: FastifyRequest<UpdatePostProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { content } = request.body;
    const { id } = request.params;
    const me = await session(authorization);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    if (!content) {
      return reply.code(400).send({ message: `Content is required.` });
    }

    const post = await prisma.post.findUnique({
      select: {
        id: true,
        content: true,
        userId: true,
      },
      where: {
        id: parseInt(id) || 0,
      },
    });

    if (!post) {
      return reply.code(404).send({ message: `Post not found.` });
    }

    if (post.userId !== me.id) {
      return reply
        .code(403)
        .send({ message: `Unable to update another user's post.` });
    }

    await prisma.post.update({
      data: { content },
      where: {
        id: post.id,
      },
    });

    await invalidateExploreCache();
    await invalidateUserCache(me.id);
    await invalidatePostCache(post.id);

    return reply.code(200).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function deletePost(
  request: FastifyRequest<GetParamsID>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { id } = request.params;
    const me = await session(authorization);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const post = await prisma.post.findUnique({
      select: {
        id: true,
        userId: true,
      },
      where: {
        id: parseInt(id) || 0,
      },
    });

    if (!post) {
      return reply.code(404).send({ message: `Post not found.` });
    }

    if (post.userId !== me.id) {
      return reply
        .code(403)
        .send({ message: `Unable to delete another user's post.` });
    }

    await prisma.post.delete({
      where: {
        id: post.id,
      },
    });

    await invalidateExploreCache();
    await invalidateUserCache(me.id);
    await invalidatePostCache(post.id);
    await invalidateLikesCache(me.id, post.id);

    return reply.code(200).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function feed(
  request: FastifyRequest<PaginationProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    const me = await session(authorization);
    const followedUsersIds = await followingIds(me.id);

    const ct = await prisma.post.count({
      where: {
        userId: { in: [...followedUsersIds, me.id] },
      },
    });

    const posts = await prisma.post.findMany({
      take,
      skip,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      where: {
        userId: { in: [...followedUsersIds, me.id] },
      },
      orderBy: {
        id: "desc",
      },
    });

    for (const p of posts as Post[]) {
      const totalLikes = (await postLikesIds(p.id)) ?? [];
      p.total_likes = totalLikes.length;
    }

    return reply.code(200).send({
      ct,
      data: posts,
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function explore(
  request: FastifyRequest<PaginationProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    const me = await session(authorization);
    const followingUsersIds = await followingIds(me.id);

    const ct = await prisma.post.count({
      where: {
        userId: { notIn: [...followingUsersIds, me.id] },
      },
    });

    const posts: any = await prisma.post.findMany({
      take,
      skip,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      where: {
        userId: { notIn: [...followingUsersIds, me.id] },
      },
      orderBy: {
        id: "desc",
      },
    });

    for (const p of posts) {
      const totalLikes = (await postLikesIds(p.id)) ?? [];
      p.total_likes = totalLikes.length;
    }

    return reply.code(200).send({
      ct,
      data: posts,
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function likePost(
  request: FastifyRequest<LikePostProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { postId } = request.body;

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    const me = await session(authorization);
    const likedPostsIds = await userLikedPostsIds(me.id);

    if (likedPostsIds.includes(postId)) {
      return reply.code(400).send({ message: `Post has already been liked.` });
    }

    const post = await prisma.post.findUnique({
      select: {
        id: true,
      },
      where: {
        id: postId,
      },
    });

    if (!post) {
      return reply.code(404).send({ message: `Post not found.` });
    }

    await RedisAddList("user:" + me.id + ":post_likes", [Date.now(), post.id]);
    await RedisAddList("post:" + post.id + ":likes", [Date.now(), me.id]);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function unlikePost(
  request: FastifyRequest<LikePostProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { postId } = request.body;

    const me = await session(authorization);
    const likedPostsIds = await userLikedPostsIds(me.id);

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    if (!likedPostsIds.includes(postId)) {
      return reply.code(400).send({ message: `Unable to unlike post.` });
    }

    await invalidateLikesCache(me.id, postId);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function postLikesIds(postId: number | string): Promise<number[]> {
  const postIds = await RedisGetList("post:" + postId + ":likes");
  return postIds.map((i) => parseInt(i));
}

async function userLikedPostsIds(userId: number): Promise<number[]> {
  const postIds = await RedisGetList("user:" + userId + ":post_likes");
  return postIds.map((i) => parseInt(i));
}

async function invalidatePostCache(postId: number) {
  try {
    await RedisClearKey("post:" + postId + ":detail");
  } catch (error) {
    logger.error("There was an error clearing post cache.");
  }
}

async function invalidateLikesCache(meId: number, postId: number) {
  try {
    await RedisRemoveFromList("user:" + meId + ":post_likes", postId);
    await RedisRemoveFromList("post:" + postId + ":likes", meId);
  } catch (error) {
    logger.error("There was an error clearing likes cache.");
  }
}

export async function invalidateExploreCache() {
  try {
    await RedisClearKeyByPattern("*:explore");
  } catch (error) {
    logger.error("There was an error clearing explorer cache.");
  }
}
