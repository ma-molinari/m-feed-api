import fp from "fastify-plugin";
import { compare, hash } from "bcryptjs";
import prisma from "@libs/prisma";
import { User } from "@prisma/client";
import session from "@utils/session";
import { RedisGetList, RedisAddList, RedisRemoveFromList } from "@libs/redis";

interface UpdateUserProps {
  Body: Pick<User, "email" | "username" | "fullName" | "avatar" | "bio">;
}

interface UpdatePasswordProps {
  Body: Pick<User, "password"> & { newPassword: string };
}

interface FollowProps {
  Body: { userId: number };
}

export default fp(async (fastify) => {
	fastify.get("/users/me", async (request, reply) => {
		try {
			const { authorization } = request.headers;

			const user = await session(authorization);

			return reply.code(200).send({
				data: user,
			});
		} catch (error) {
			return reply.code(500).send({ message: `Server error!` });
		}
	});

	fastify.put<UpdateUserProps>("/users/profile", async (request, reply) => {
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
	});

	fastify.patch<UpdatePasswordProps>(
		"/users/password",
		async (request, reply) => {
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
	);

	fastify.post<FollowProps>("/users/follow", async (request, reply) => {
		try {
			const { authorization } = request.headers;
			const { userId } = request.body;
			const me = await session(authorization);
			const usersFollowingId = await RedisGetList("user:" + me.id + ":following");

			if (!userId) {
				return reply.code(400).send({ message: `UserID is required.` });
			}

			if (me.id === userId) {
				return reply.code(400).send({ message: `Can't follow yourself.` });
			}

			if (usersFollowingId.includes(userId.toString())) {
				return reply.code(400).send({ message: `User has already been followed.` });
			}

			await RedisAddList("user:" + me.id + ":following", [Date.now(), userId]);
			await RedisAddList("user:" + userId + ":followers", [Date.now(), me.id]);

			return reply.code(200).send({ message: "OK" });
		} catch (error) {
			return reply.code(500).send({ message: `Server error!` });
		}
	});

	fastify.post<FollowProps>("/users/unfollow", async (request, reply) => {
		try {
			const { authorization } = request.headers;
			const { userId } = request.body;
			const me = await session(authorization);
			const usersFollowingId = await RedisGetList("user:" + me.id + ":following");

			if (!userId) {
				return reply.code(400).send({ message: `UserID is required.` });
			}

			if (!usersFollowingId.includes(userId.toString())) {
				return reply.code(400).send({ message: `Unable to unfollow user.` });
			}

			await RedisRemoveFromList("user:" + me.id + ":following", userId);
			await RedisRemoveFromList("user:" + userId + ":followers", me.id);

			return reply.code(200).send({ message: "OK" });
		} catch (error) {
			return reply.code(500).send({ message: `Server error!` });
		}
	});
});
