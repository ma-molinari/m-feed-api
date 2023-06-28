import { Comment } from "@prisma/client";

interface GetParamsID {
  Params: {
    postId: string;
  };
}

interface CreateCommentProps extends GetParamsID {
  Body: Pick<Comment, "content" | "postId">;
}

export type { CreateCommentProps };
