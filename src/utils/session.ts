import prisma from "@libs/prisma";
import { RedisGetJson } from "@libs/redis";
import { Post, User } from "@prisma/client";
import { verify } from "jsonwebtoken";

interface UserProps extends User {
  posts: Post[];
}

export default async function session(
  authorization: string
): Promise<UserProps> {
  try {
    if (!authorization) {
      return null;
    }

    const [, token] = authorization.split(` `);
    const decoded = verify(token, process.env.JWT_KEY) as { id: string };

    if (!decoded) {
      return null;
    }

    const cachedPost = await RedisGetJson("user:" + decoded.id + ":profile");
    if (cachedPost) {
      return cachedPost as UserProps;
    }

    const user = await prisma.user.findUnique({
      select: {
        id: true,
        avatar: true,
        fullName: true,
        username: true,
        email: true,
        bio: true,
        posts: true,
      },
      where: {
        id: parseInt(decoded.id),
      },
    });

    if (!user) {
      return null;
    }

    return user as UserProps;
  } catch (error) {
    return null;
  }
}
