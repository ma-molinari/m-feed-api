import { compare, hash } from "bcryptjs";
import prisma from "@libs/prisma";
import { User } from "@prisma/client";
import session from "@utils/session";
import { RedisGetList, RedisAddList, RedisRemoveFromList } from "@libs/redis";
import { FastifyReply, FastifyRequest } from "fastify";
import { invalidateExploreCache } from "./post";

interface UpdateUserProps {
  Body: Pick<User, "email" | "username" | "fullName" | "avatar" | "bio">;
}

interface UpdatePasswordProps {
  Body: Pick<User, "password"> & { newPassword: string };
}

interface FollowProps {
  Body: { userId: number };
}

interface PaginationProps<T = {}> {
  Querystring: {
    limit: string;
    offset: string;
  } & T;
}

interface SearchProps extends PaginationProps<{ search: string }> {}

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
  request: FastifyRequest<SearchProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { limit = "10", offset = "0", search = "" } = request.query;
    const me = await session(authorization);

    const where = {
      OR: [
        {
          fullName: {
            contains: search,
          },
        },
        { username: { contains: search } },
      ],
      NOT: {
        id: {
          in: [me.id],
        },
      },
    };

    const ct = await prisma.user.count({ where });

    const users = await prisma.user.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
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
  request: FastifyRequest<FollowProps>,
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
  request: FastifyRequest<FollowProps>,
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
