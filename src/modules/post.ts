import fp from "fastify-plugin";
import prisma from "@libs/prisma";
import session from "@utils/session";

export default fp(async (fastify, opts) => {
  fastify.get("/posts/feed", async (request, reply) => {
    try {
      const { authorization } = request.headers;
      const me = await session(authorization);
      const usersFollowing = [2];

      const posts = await prisma.post.findMany({
        include: {
          user: true,
        },
        where: {
          userId: { in: [...usersFollowing, me.id] },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return reply.code(200).send({
        data: posts,
      });
    } catch (error) {
      return reply.code(500).send({ message: `Server error!` });
    }
  });

  fastify.get("/posts/discover", async (request, reply) => {
    try {
      const { authorization } = request.headers;
      const me = await session(authorization);

      const posts = await prisma.post.findMany({
        include: {
          user: true,
        },
        where: {
          userId: { not: me.id },
        },
        orderBy: {
          createdAt: "desc",
        },
      });

      return reply.code(200).send({
        data: posts,
      });
    } catch (error) {
      return reply.code(500).send({ message: `Server error!` });
    }
  });
});
