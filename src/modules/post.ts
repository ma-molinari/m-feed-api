import prisma from "@libs/prisma";
import session from "@utils/session";
import { FastifyReply, FastifyRequest } from "fastify";
import { followingIds } from "./user";

interface PaginationProps {
  Querystring: {
    limit: string;
    offset: string;
  };
}

export async function feed(request: FastifyRequest<PaginationProps>, reply: FastifyReply) {
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

export async function discover(request: FastifyRequest<PaginationProps>, reply: FastifyReply) {
	try {
		const { authorization } = request.headers;
		const { limit = "10", offset = "0" } = request.query;
		const me = await session(authorization);
		const followedUsersIds = await followingIds(me.id);

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

		return reply.code(200).send({
			ct,
			data: posts,
		});
	} catch (error) {
		return reply.code(500).send({ message: `Server error!` });
	}
}