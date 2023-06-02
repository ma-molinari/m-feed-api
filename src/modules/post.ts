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

interface GetPostProps {
  Params: {
    id: string;
  };
}

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
    const { limit = "10", offset = "0" } = request.query;
    const isFirstPage = offset === "0";

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
      skip: parseInt(offset),
      take: parseInt(limit),
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
      select: {
        id: true,
        username: true,
        fullName: true,
        avatar: true,
      },
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

export async function getPost(
  request: FastifyRequest<GetPostProps>,
  reply: FastifyReply
) {
  try {
    const { id } = request.params;

    if (!id) {
      return reply.code(400).send({
        message: `ID is required.`,
      });
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
        id: parseInt(id),
      },
    });

    if (!post) {
      return reply.code(404).send({
        message: `Not found.`,
      });
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

export async function invalidateExploreCache() {
  try {
    await RedisClearKeyByPattern("*:explore");
  } catch (error) {
    logger.error("There was an error clearing explorer cache.");
  }
}
