import prisma from "@libs/prisma";
import { User } from "@prisma/client";
import { verify } from "jsonwebtoken";

export default async function session(authorization: string): Promise<User> {
  try {
    if (!authorization) {
      return null;
    }

    const [, token] = authorization.split(` `);
    const decoded = verify(token, process.env.JWT_KEY) as { id: string };

    if (!decoded) {
      return null;
    }

    const user = await prisma.user.findUnique({
      where: {
        id: parseInt(decoded.id),
      },
    });

    if (!user) {
      return null;
    }

    delete user.password;
    return user;
  } catch (error) {
    return null;
  }
}
