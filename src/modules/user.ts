import { FastifyReply, FastifyRequest } from "fastify";
import { compare, hash } from "bcryptjs";
import prisma from "@libs/prisma";
import session from "@utils/session";
import {
  GetUserProps,
  UpdateUserProps,
  UpdatePasswordProps,
  SearchUserProps,
  FollowUserProps,
  GetUserPostsProps,
} from "@entities/user";
import {
  setUserCache,
  getUserCache,
  invalidateUserCache,
  setUserFollowerCache,
  getFollowersCache,
  getFollowingCache,
  invalidateUserFollowerCache,
} from "@cache/user";
import { getPostLikesCache } from "@cache/post";
import { paginationProps } from "./pagination";
import { deleteFile } from "./file";

export async function me(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { authorization } = request.headers;

    const user = await session(authorization);
    const followers = await getFollowersCache(user.id);
    const following = await getFollowingCache(user.id);
    const totalPosts = await prisma.post.count({
      where: { userId: user.id || 0 },
    });

    return reply.code(200).send({
      data: {
        ...user,
        followers: followers.length,
        following: following.length,
        posts: totalPosts,
      },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getUser(
  request: FastifyRequest<GetUserProps>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const followers = await getFollowersCache(id);
    const following = await getFollowingCache(id);
    const totalPosts = await prisma.post.count({
      where: { userId: parseInt(id) || 0 },
    });
    const cachedUser = await getUserCache(id);

    if (cachedUser) {
      return {
        data: {
          ...cachedUser,
          followers: followers.length,
          following: following.length,
          posts: totalPosts,
        },
      };
    }

    const user = await prisma.user.findUnique({
      select: {
        id: true,
        avatar: true,
        username: true,
        fullName: true,
        bio: true,
        email: true,
        createdAt: true,
      },
      where: {
        id: parseInt(id) || 0,
      },
    });

    if (!user) {
      return reply.code(404).send({ message: `User not found.` });
    }

    await setUserCache(user.id, user);

    return reply.code(200).send({
      data: {
        ...user,
        followers: followers.length,
        following: following.length,
        posts: totalPosts,
      },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getUserFollowers(
  request: FastifyRequest<GetUserPostsProps>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const usersIds = await getFollowersCache(id);

    const ct = await prisma.user.count({
      where: {
        id: {
          in: usersIds,
        },
      },
    });

    const users = await prisma.user.findMany({
      take,
      skip,
      select: {
        id: true,
        avatar: true,
        username: true,
        fullName: true,
        bio: true,
        email: true,
        createdAt: true,
      },
      where: {
        id: {
          in: usersIds,
        },
      },
    });

    return {
      ct,
      data: users,
    };
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getUserFollowings(
  request: FastifyRequest<GetUserPostsProps>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const usersIds = await getFollowingCache(id);

    const ct = await prisma.user.count({
      where: {
        id: {
          in: usersIds,
        },
      },
    });

    const users = await prisma.user.findMany({
      take,
      skip,
      select: {
        id: true,
        avatar: true,
        username: true,
        fullName: true,
        bio: true,
        email: true,
        createdAt: true,
      },
      where: {
        id: {
          in: usersIds,
        },
      },
    });

    return {
      ct,
      data: users,
    };
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function updateProfile(
  request: FastifyRequest<UpdateUserProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const body = request.body;

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email: body.email }, { username: body.username }],
      },
    });

    if (user) {
      if (user.email === body.email) {
        return reply.code(400).send({ message: `Email already used.` });
      }

      return reply.code(400).send({ message: `Username already used.` });
    }

    const me = await session(authorization);

    await prisma.user.update({
      data: body,
      where: {
        id: me.id,
      },
    });

    if (body.avatar != me.avatar) {
      await deleteFile(me.avatar);
    }
    await invalidateUserCache(me.id);

    return reply.code(200).send({
      data: {
        ...me,
        ...body,
      },
    });
  } catch (error) {
    return reply
      .code(500)
      .send({ message: `Server error!`, error: error.message });
  }
}

export async function updatePassword(
  request: FastifyRequest<UpdatePasswordProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { password, newPassword } = request.body;

    if (password === newPassword) {
      return reply.code(401).send({
        message: `New password cannot be the same as the previous.`,
      });
    }

    const me = await session(authorization);
    const user = await prisma.user.findFirst({
      where: {
        id: me.id,
      },
    });

    if (!(await compare(password, user.password))) {
      return reply.code(401).send({
        message: `Invalid password.`,
      });
    }

    const encryptedPassword = await hash(newPassword, 10);

    await prisma.user.update({
      data: {
        password: encryptedPassword,
      },
      where: {
        id: user.id,
      },
    });

    return reply.code(200).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function search(
  request: FastifyRequest<SearchUserProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { query = "", limit = "20" } = request.query;

    const me = await session(authorization);

    const where = {
      OR: [
        {
          fullName: {
            contains: query,
          },
        },
        { username: { contains: query } },
      ],
      NOT: {
        id: {
          in: [me.id],
        },
      },
    };

    const ct = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
      take: parseInt(limit) || 0,
      select: {
        id: true,
        username: true,
        fullName: true,
        avatar: true,
      },
      where,
      orderBy: {
        id: "desc",
      },
    });

    return reply.code(200).send({
      ct,
      data: users,
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function usersLikedPost(
  request: FastifyRequest<GetUserPostsProps>,
  reply: FastifyReply,
) {
  try {
    const { id } = request.params;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const post = await prisma.post.findUnique({
      select: {
        id: true,
      },
      where: {
        id: parseInt(id) || 0,
      },
    });

    if (!post) {
      return reply.code(404).send({ message: `Post not found.` });
    }

    const usersLikesIds = await getPostLikesCache(post.id);

    const ct = await prisma.user.count({
      where: {
        id: {
          in: usersLikesIds,
        },
      },
    });

    const users = await prisma.user.findMany({
      take,
      skip,
      select: {
        id: true,
        avatar: true,
        username: true,
        fullName: true,
        bio: true,
        email: true,
        createdAt: true,
      },
      where: {
        id: {
          in: usersLikesIds,
        },
      },
    });

    return {
      ct,
      data: users,
    };
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function follow(
  request: FastifyRequest<FollowUserProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { userId } = request.body;

    if (!userId) {
      return reply.code(400).send({ message: `UserID is required.` });
    }

    const me = await session(authorization);
    const followedUsersIds = await getFollowingCache(me.id);

    if (me.id === userId) {
      return reply.code(400).send({ message: `Can't follow yourself.` });
    }

    if (followedUsersIds.includes(userId)) {
      return reply
        .code(400)
        .send({ message: `User has already been followed.` });
    }

    const user = await prisma.user.findUnique({
      select: {
        id: true,
      },
      where: {
        id: userId,
      },
    });

    if (!user) {
      return reply.code(404).send({ message: `User not found.` });
    }

    await setUserFollowerCache(me.id, user.id);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function unfollow(
  request: FastifyRequest<FollowUserProps>,
  reply: FastifyReply,
) {
  try {
    const { authorization } = request.headers;
    const { userId } = request.body;

    const me = await session(authorization);
    const followedUsersIds = await getFollowingCache(me.id);

    if (!userId) {
      return reply.code(400).send({ message: `UserID is required.` });
    }

    if (!followedUsersIds.includes(userId)) {
      return reply.code(400).send({ message: `Unable to unfollow user.` });
    }

    await invalidateUserFollowerCache(me.id, userId);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}
