import { FastifyReply, FastifyRequest } from "fastify";
import { compare, hash } from "bcryptjs";
import { sign } from "jsonwebtoken";
import prisma from "@libs/prisma";
import { LoginProps, RegisterProps } from "@entities/auth";

export async function login(
  request: FastifyRequest<LoginProps>,
  reply: FastifyReply
) {
  try {
    const { email, password } = request.body;

    if (!email || !password) {
      return reply
        .code(400)
        .send({ message: `E-mail and Password are required.` });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username: email }],
      },
    });

    if (!user || !(await compare(password, user.password))) {
      return reply.code(401).send({
        message: `Invalid email or password.`,
      });
    }

    const token = sign({ id: user.id }, process.env.JWT_KEY, {
      algorithm: `HS256`,
      expiresIn: process.env.JWT_EXPIRY_SECONDS,
    });

    return reply.code(200).send({
      data: {
        token,
        user: {
          id: user.id,
          email: user.email,
          username: user.username,
          fullName: user.fullName,
        },
      },
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function register(
  request: FastifyRequest<RegisterProps>,
  reply: FastifyReply
) {
  try {
    const { email, username, fullName, password } = request.body;

    if (!email || !username || !fullName || !password) {
      return reply.code(400).send({ message: `All fields are required.` });
    }

    const user = await prisma.user.findFirst({
      where: {
        OR: [{ email }, { username }],
      },
    });

    if (user) {
      if (user.email === email) {
        return reply.code(400).send({ message: `Email already used.` });
      }

      return reply.code(400).send({ message: `Username already used.` });
    }

    const encryptedPassword = await hash(password, 10);

    await prisma.user.create({
      data: {
        email: email.toLowerCase(),
        password: encryptedPassword,
        username,
        fullName,
      },
    });

    return reply.code(201).send({ message: `ok` });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}
