import prisma from "@libs/prisma";
import { User } from "@prisma/client";
import session from "@utils/session";
import fp from "fastify-plugin";

interface UpdateUserProps {
  Body: Pick<
    User,
    "email" | "username" | "fullName" | "avatar" | "description"
  >;
}

interface UpdatePasswordProps {
  Body: Pick<User, "password">;
}

export default fp(async (fastify, opts) => {
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

  fastify.patch<UpdatePasswordProps>("/users/password", (request, reply) => {
    return reply.code(200).send({ status: "ok" });
  });
});
