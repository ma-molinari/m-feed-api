import { FastifyReply, FastifyRequest } from "fastify";
import prisma from "@libs/prisma";
import session from "@utils/session";
import { CreateCommentProps } from "@entities/comment";

export async function createComment(
  request: FastifyRequest<CreateCommentProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const me = await session(authorization);

    const { postId } = request.params;
    const { content } = request.body;

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    if (!content) {
      return reply.code(400).send({ message: `Content is required.` });
    }

    const post = await prisma.post.findUnique({
      select: {
        id: true,
      },
      where: {
        id: parseInt(postId) || 0,
      },
    });

    if (!post) {
      return reply
        .code(404)
        .send({ message: `Post with id equal ${postId} not found.` });
    }

    await prisma.comment.create({
      data: {
        userId: me.id,
        postId: post.id,
        content,
      },
    });

    return reply.code(201).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}
