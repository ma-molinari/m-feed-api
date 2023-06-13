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
import { invalidateExploreCache } from "@modules/post";
import {
  GetUserProps,
  UpdateUserProps,
  UpdatePasswordProps,
  SearchUserProps,
  FollowUserProps,
} from "@entities/user";

export async function me(request: FastifyRequest, reply: FastifyReply) {
  try {
    const { authorization } = request.headers;

    const user = await session(authorization);

    return reply.code(200).send({
      data: user,
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
    const cachedPost = await RedisGetJson(cacheKey);
    if (cachedPost) {
      return cachedPost;
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
        posts: {
          orderBy: {
            id: "desc",
          },
        },
      },
      where: {
        id: parseInt(id) || 0,
      },
    });

    if (!user) {
      return reply.code(404).send({ message: `Not found.` });
    }

    const response = { data: user };

    await RedisSetTTL(cacheKey, response, 86400); // 1 day in seconds.

    return reply.code(200).send(response);
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

export async function follow(
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

    if (me.id === userId) {
      return reply.code(400).send({ message: `Can't follow yourself.` });
    }

    if (followedUsersIds.includes(userId)) {
      return reply
        .code(400)
        .send({ message: `User has already been followed.` });
    }

    await followUser(me.id, userId);

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

    await unfollowUser(me.id, userId);

    return reply.code(200).send({ message: "OK" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function followUser(meId: number, userId: number): Promise<void> {
  await RedisAddList("user:" + meId + ":following", [Date.now(), userId]);
  await RedisAddList("user:" + userId + ":followers", [Date.now(), meId]);
  await invalidateExploreCache();
}

export async function unfollowUser(
  meId: number,
  userId: number
): Promise<void> {
  await RedisRemoveFromList("user:" + meId + ":following", userId);
  await RedisRemoveFromList("user:" + userId + ":followers", meId);
  await invalidateExploreCache();
}

export async function followerIds(userId: number): Promise<number[]> {
  const userIds = await RedisGetList("user:" + userId + ":followers");
  return userIds.map((i) => parseInt(i));
}

export async function followingIds(userId: number): Promise<number[]> {
  const userIds = await RedisGetList("user:" + userId + ":following");
  return userIds.map((i) => parseInt(i));
}

export async function invalidateUserCache(id: number) {
  try {
    await RedisClearKey("user:" + id + ":profile");
  } catch (error) {
    logger.error("There was an error clearing user cache.");
  }
}
