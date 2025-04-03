import { FastifyReply, FastifyRequest } from "fastify";
import prisma from "@libs/prisma";
import session from "@utils/session";
import { CreateCommentProps, GetParamsID } from "@entities/comment";
import { PaginationProps } from "@entities/pagination";
import { paginationProps } from "./pagination";
import { notify, SSE_EVENTS } from "./notification";

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
      return reply.code(404).send({ message: `Post not found.` });
    }

    const comment = await prisma.comment.create({
      data: {
        userId: me.id,
        postId: post.id,
        content,
      },
    });
    notify(SSE_EVENTS.CREATE_COMMENT, comment);

    return reply.code(201).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function getComments(
  request: FastifyRequest<PaginationProps<GetParamsID>>,
  reply: FastifyReply
) {
  try {
    const { postId } = request.params;
    const { limit = "10", page = "0" } = request.query;
    const { take, skip } = paginationProps(limit, page);

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
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
      return reply.code(404).send({ message: `Post not found.` });
    }

    const ct = await prisma.comment.count({
      where: {
        postId: post.id,
      },
    });

    const comments = await prisma.comment.findMany({
      take,
      skip,
      include: {
        user: {
          select: {
            id: true,
            username: true,
            fullName: true,
            avatar: true,
          },
        },
      },
      where: {
        postId: post.id,
      },
      orderBy: {
        id: "desc",
      },
    });

    return reply.code(200).send({
      ct,
      data: comments,
    });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function updateComment(
  request: FastifyRequest<CreateCommentProps>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const me = await session(authorization);

    const { postId, commentId } = request.params;
    const { content } = request.body;

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    if (!content) {
      return reply.code(400).send({ message: `Content is required.` });
    }

    const post = await prisma.post.findUnique({
      select: { id: true },
      where: { id: parseInt(postId) || 0 },
    });

    if (!post) {
      return reply.code(404).send({ message: `Post not found.` });
    }

    const comment = await prisma.comment.findFirst({
      select: { id: true, userId: true },
      where: { id: parseInt(commentId) || 0, postId: post.id },
    });

    if (!comment) {
      return reply.code(404).send({ message: `Comment not found.` });
    }

    if (me.id !== comment.userId) {
      return reply
        .code(403)
        .send({ message: `Unable to update another user's comment.` });
    }

    await prisma.comment.update({
      data: { content },
      where: {
        id: comment.id,
      },
    });

    return reply.code(200).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}

export async function deleteComment(
  request: FastifyRequest<GetParamsID>,
  reply: FastifyReply
) {
  try {
    const { authorization } = request.headers;
    const { postId, commentId } = request.params;
    const me = await session(authorization);

    if (!postId) {
      return reply.code(400).send({ message: `PostID is required.` });
    }

    const post = await prisma.post.findUnique({
      select: { id: true },
      where: { id: parseInt(postId) || 0 },
    });

    if (!post) {
      return reply.code(404).send({ message: `Post not found.` });
    }

    const comment = await prisma.comment.findFirst({
      select: { id: true, userId: true, postId: true },
      where: { id: parseInt(commentId) || 0, postId: post.id },
    });

    if (!comment) {
      return reply.code(404).send({ message: `Comment not found.` });
    }

    if (me.id !== comment.userId) {
      return reply
        .code(403)
        .send({ message: `Unable to delete another user's comment.` });
    }

    await prisma.comment.delete({
      where: {
        id: comment.id,
      },
    });
    notify(SSE_EVENTS.DELETE_COMMENT, comment);

    return reply.code(200).send({ message: "ok" });
  } catch (error) {
    return reply.code(500).send({ message: `Server error!` });
  }
}
