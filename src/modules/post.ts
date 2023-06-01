import prisma from "@libs/prisma";
import session from "@utils/session";
import { FastifyReply, FastifyRequest } from "fastify";
import { RedisClearKeyByPattern, RedisGetJson, RedisSetTTL } from "@libs/redis";
import { followingIds } from "./user";
import logger from "@libs/logger";

interface PaginationProps<T = {}> {
  Querystring: {
    limit: string;
    offset: string;
  } & T;
}

interface SearchProps extends PaginationProps<{ search: string }> {}

export async function feed(
  request: FastifyRequest<PaginationProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { limit = "10", offset = "0" } = request.query;
    const me = await session(authorization);
    const followedUsersIds = await followingIds(me.id);

    const ct = await prisma.post.count({
      where: {
        userId: { in: [...followedUsersIds, me.id] },
      },
    });

    const posts = await prisma.post.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      include: {
        user: true,
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
    const { limit = "10", offset = "0" } = request.query;
    const me = await session(authorization);
    const followedUsersIds = await followingIds(me.id);

    const cachedPosts = await RedisGetJson("user:" + me.id + ":explore");
    if (cachedPosts) {
      return cachedPosts;
    }

    const ct = await prisma.post.count({
      where: {
        userId: { notIn: [...followedUsersIds, me.id] },
      },
    });

    const posts = await prisma.post.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      include: {
        user: true,
      },
      where: {
        userId: { notIn: [...followedUsersIds, me.id] },
      },
      orderBy: {
        id: "desc",
      },
    });

    await RedisSetTTL("user:" + me.id + ":explore", {
      ct,
      data: posts,
    });

    return reply.code(200).send({
      ct,
      data: posts,
    });
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

    const ct = await prisma.user.count({
      where: {
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
      },
    });

    const users = await prisma.user.findMany({
      skip: parseInt(offset),
      take: parseInt(limit),
      where: {
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
      },
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

export async function clearExploreCache() {
  try {
    await RedisClearKeyByPattern("*:explore");
  } catch (error) {
    logger.error("There was an error clearing explorer cache");
  }
}
