import fp from "fastify-plugin";
import prisma from "@libs/prisma";
import session from "@utils/session";

interface PaginationProps {
  Querystring: {
    limit: string;
    offset: string;
  };
}

export default fp(async (fastify, opts) => {
	fastify.get<PaginationProps>("/posts/feed", async (request, reply) => {
		try {
			const { authorization } = request.headers;
			const { limit = "10", offset = "0" } = request.query;

			const me = await session(authorization);
			const usersFollowing = [2];

			const ct = await prisma.post.count({
				where: {
					userId: { in: [...usersFollowing, me.id] },
				},
			});

			const posts = await prisma.post.findMany({
				skip: parseInt(offset),
				take: parseInt(limit),
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
				ct,
				data: posts,
			});
		} catch (error) {
			return reply.code(500).send({ message: `Server error!` });
		}
	});

	fastify.get<PaginationProps>("/posts/discover", async (request, reply) => {
		try {
			const { authorization } = request.headers;
			const { limit = "10", offset = "0" } = request.query;

			const me = await session(authorization);

			const ct = await prisma.post.count({
				where: {
					userId: { not: me.id },
				},
			});

			const posts = await prisma.post.findMany({
				skip: parseInt(offset),
				take: parseInt(limit),
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
				ct,
				data: posts,
			});
		} catch (error) {
			return reply.code(500).send({ message: `Server error!` });
		}
	});
});
