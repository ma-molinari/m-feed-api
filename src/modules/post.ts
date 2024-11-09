import { FastifyReply, FastifyRequest } from "fastify";
import prisma from "@libs/prisma";
import {
  Post,
  CreatePostProps,
  GetParamsID,
  LikePostProps,
  UpdatePostProps,
} from "@entities/post";
import { paginationProps } from "@modules/pagination";
import { PaginationProps } from "@entities/pagination";
import {
  setPostCache,
  getPostCache,
  invalidatePostCache,
  setPostLikesCache,
  getPostLikesCache,
  getUserLikesPostCache,
  invalidatePostLikesCache,
} from "@cache/post";
import session from "@utils/session";
import { getFollowingCache, invalidateUserCache } from "@cache/user";
import { deleteFile } from "./file";

export async function createPost(
  request: FastifyRequest<CreatePostProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { image, content } = request.body;
    const me = await session(authorization);

    if (!content) {
      return reply.code(400).send({ message: `Content is required.` });
    }

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

    await invalidateUserCache(me.id);

    return reply.code(201).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getPost(
  request: FastifyRequest<GetParamsID>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const totalLikes = await getPostLikesCache(id);

    const totalComments = await prisma.comment.count({
      where: {
        postId: parseInt(id) || 0,
      },
    });

    const cachedPost = await getPostCache(id);
    if (cachedPost) {
      return {
        data: {
          ...cachedPost,
          total_likes: totalLikes.length,
          total_comments: totalComments,
        },
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

    await setPostCache(post.id, post);

    return reply.code(200).send({
      data: {
        ...post,
        total_likes: totalLikes.length,
        total_comments: totalComments,
      },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getLikedPostsByMe(
  request: FastifyRequest,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const user = await session(authorization);
    const likes = await getUserLikesPostCache(user.id);

    return reply.code(200).send({
      data: likes,
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getUserPosts(
  request: FastifyRequest<PaginationProps<GetParamsID>>,
  reply: FastifyReply,
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
      include: { user: true },
      take,
      skip,
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });

    for (const p of posts as Post[]) {
      const totalLikes = await getPostLikesCache(p.id);
      const totalComments = await prisma.comment.count({
        where: { postId: p.id },
      });

      p.total_likes = totalLikes.length;
      p.total_comments = totalComments;
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
  reply: FastifyReply,
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

    await invalidateUserCache(me.id);
    await invalidatePostCache(post.id);

    return reply.code(200).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function deletePost(
  request: FastifyRequest<GetParamsID>,
  reply: FastifyReply,
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
        image: true,
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

    await deleteFile(post.image);
    await invalidateUserCache(me.id);
    await invalidatePostCache(post.id);
    await invalidatePostLikesCache(me.id, post.id);

    return reply.code(200).send({ message: "ok" });
  } catch (error) {
    return reply
      .code(500)
      .send({ message: `Server error!`, error: error.message });
  }
}

export async function feed(
  request: FastifyRequest<PaginationProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    const me = await session(authorization);
    const followedUsersIds = await getFollowingCache(me.id);

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
      const totalLikes = await getPostLikesCache(p.id);
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
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    const me = await session(authorization);
    const followingUsersIds = await getFollowingCache(me.id);

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
      const totalLikes = await getPostLikesCache(p.id);
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
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { postId } = request.body;

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    const me = await session(authorization);
    const likedPostsIds = await getUserLikesPostCache(me.id);

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

    await setPostLikesCache(me.id, post.id);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function unlikePost(
  request: FastifyRequest<LikePostProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { postId } = request.body;

    const me = await session(authorization);
    const likedPostsIds = await getUserLikesPostCache(me.id);

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    if (!likedPostsIds.includes(postId)) {
      return reply.code(400).send({ message: `Unable to unlike post.` });
    }

    await invalidatePostLikesCache(me.id, postId);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}
