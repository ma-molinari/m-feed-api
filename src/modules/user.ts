import { FastifyReply, FastifyRequest } from "fastify";
import { compare, hash } from "bcryptjs";
import prisma from "@libs/prisma";
import session from "@utils/session";
import {
  RedisGetList,
  RedisAddList,
  RedisRemoveFromList,
  RedisGetJson,
  RedisSetTTL,
} from "@libs/redis";
import logger from "@libs/logger";
import { RedisClearKey } from "@libs/redis";
import { invalidateExploreCache, postLikesIds } from "@modules/post";
import {
  GetUserProps,
  UpdateUserProps,
  UpdatePasswordProps,
  SearchUserProps,
  FollowUserProps,
  GetUserPostsProps,
} from "@entities/user";
import { paginationProps } from "./pagination";
import { User } from "@prisma/client";

export async function me(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { authorization } = request.headers;

    const user = await session(authorization);
    const followers = (await followerIds(user.id)) ?? [];
    const following = (await followingIds(user.id)) ?? [];

    return reply.code(200).send({
      data: {
        ...user,
        followers: followers.length,
        following: following.length,
      },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getUser(
  request: FastifyRequest<GetUserProps>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const cacheKey = "user:" + id + ":profile";
    const cachedPost = await RedisGetJson<{ data: User }>(cacheKey);

    const followers = (await followerIds(id)) ?? [];
    const following = (await followingIds(id)) ?? [];

    if (cachedPost) {
      return {
        data: {
          ...cachedPost.data,
          followers: followers.length,
          following: following.length,
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

    await RedisSetTTL(cacheKey, { data: user }, 86400); // 1 day in seconds.

    return reply.code(200).send({
      data: {
        ...user,
        followers: followers.length,
        following: following.length,
      },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getUserFollowers(
  request: FastifyRequest<GetUserPostsProps>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const usersIds = await followerIds(id);

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
  reply: FastifyReply
) {
  try {
    const { id } = request.params;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    if (!id) {
      return reply.code(400).send({ message: `ID is required.` });
    }

    const usersIds = await followingIds(id);

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
  reply: FastifyReply
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

    await invalidateUserCache(me.id);

    return reply.code(200).send({
      data: {
        ...me,
        ...body,
      },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function updatePassword(
  request: FastifyRequest<UpdatePasswordProps>,
  reply: FastifyReply
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
  reply: FastifyReply
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
  reply: FastifyReply
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

    const usersLikesIds = await postLikesIds(post.id);

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
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { userId } = request.body;

    if (!userId) {
      return reply.code(400).send({ message: `UserID is required.` });
    }

    const me = await session(authorization);
    const followedUsersIds = await followingIds(me.id);

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

    await RedisAddList("user:" + me.id + ":following", [Date.now(), user.id]);
    await RedisAddList("user:" + user.id + ":followers", [Date.now(), me.id]);
    await invalidateExploreCache();

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function unfollow(
  request: FastifyRequest<FollowUserProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { userId } = request.body;

    const me = await session(authorization);
    const followedUsersIds = await followingIds(me.id);

    if (!userId) {
      return reply.code(400).send({ message: `UserID is required.` });
    }

    if (!followedUsersIds.includes(userId)) {
      return reply.code(400).send({ message: `Unable to unfollow user.` });
    }

    await RedisRemoveFromList("user:" + me.id + ":following", userId);
    await RedisRemoveFromList("user:" + userId + ":followers", me.id);
    await invalidateExploreCache();

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function followerIds(userId: number | string): Promise<number[]> {
  const userIds = await RedisGetList("user:" + userId + ":followers");
  return userIds.map((i) => parseInt(i));
}

export async function followingIds(userId: number | string): Promise<number[]> {
  const userIds = await RedisGetList("user:" + userId + ":following");
  return userIds.map((i) => parseInt(i));
}

export async function invalidateUserCache(userId: number) {
  try {
    await RedisClearKey("user:" + userId + ":profile");
    await RedisClearKey("user:" + userId + ":posts");
  } catch (error) {
    logger.error("There was an error clearing user cache.");
  }
}
