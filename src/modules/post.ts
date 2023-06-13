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

    const cacheKey = "post:" + id + ":detail";
    const cachedPost = await RedisGetJson(cacheKey);
    if (cachedPost) {
      return cachedPost;
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
      return reply.code(404).send({ message: `Not found.` });
    }

    const response = {
      data: post,
    };

    await RedisSetTTL(cacheKey, response, 86400); // 1 day in seconds.

    return reply.code(200).send(response);
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getPostLikes(
  request: FastifyRequest<GetParamsID>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const likes = await postLikesIds(parseInt(id) || 0);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const response = {
      data: {
        likes: likes.length,
      },
    };

    return reply.code(200).send(response);
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
    const { id } = request.params;
    const { content } = request.body;
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
      return reply.code(404).send({ message: `Not found.` });
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
      return reply.code(404).send({ message: `Not found.` });
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

    const isFirstPage = page === "0";

    const me = await session(authorization);
    const followedUsersIds = await followingIds(me.id);

    const cacheKey = "user:" + me.id + ":explore";
    if (isFirstPage) {
      const cachedPosts = await RedisGetJson(cacheKey);
      if (cachedPosts) {
        return cachedPosts;
      }
    }

    const ct = await prisma.post.count({
      where: {
        userId: { notIn: [...followedUsersIds, me.id] },
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
        userId: { notIn: [...followedUsersIds, me.id] },
      },
      orderBy: {
        id: "desc",
      },
    });

    if (isFirstPage) {
      await RedisSetTTL(
        cacheKey,
        {
          ct,
          data: posts,
        },
        3600
      );
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

    const me = await session(authorization);
    const likedPostsIds = await userLikedPostsIds(me.id);

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    if (likedPostsIds.includes(postId)) {
      return reply.code(400).send({ message: `Post has already been liked.` });
    }

    await RedisAddList("user:" + me.id + ":post_likes", [Date.now(), postId]);
    await RedisAddList("post:" + postId + ":likes", [Date.now(), me.id]);

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

    await RedisRemoveFromList("user:" + me.id + ":post_likes", postId);
    await RedisRemoveFromList("post:" + postId + ":likes", me.id);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

async function postLikesIds(postId: number): Promise<number[]> {
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

export async function invalidateExploreCache() {
  try {
    await RedisClearKeyByPattern("*:explore");
  } catch (error) {
    logger.error("There was an error clearing explorer cache.");
  }
}
