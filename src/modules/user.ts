import fp from "fastify-plugin";
import { compare, hash } from "bcryptjs";
import prisma from "@libs/prisma";
import { User } from "@prisma/client";
import session from "@utils/session";

interface UpdateUserProps {
  Body: Pick<User, "email" | "username" | "fullName" | "avatar" | "bio">;
}

interface UpdatePasswordProps {
  Body: Pick<User, "password"> & { newPassword: string };
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

	fastify.post("/users/follow", async (request, reply) => {
		try {
			return reply.code(204);
			//following
			// await RedisSetZADD("user:" + 1 + ":following", [Date.now(), 2]);
			//followers
			// await RedisSetZADD("user:" + 2 + ":followers", [Date.now(), 1]);
		} catch (error) {
			return reply.code(500).send({ message: `Server error!` });
		}
	});

	fastify.post("/users/unfollow", async (request, reply) => {
		try {
			return reply.code(204);
		} catch (error) {
			return reply.code(500).send({ message: `Server error!` });
		}
	});
});
