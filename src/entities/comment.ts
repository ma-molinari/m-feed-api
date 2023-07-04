import { Comment } from "@prisma/client";

interface GetParamsID {
  Params: {
    postId: string;
    commentId?: string;
  };
}

interface CreateCommentProps extends GetParamsID {
  Body: Pick<Comment, "content">;
}

export type { CreateCommentProps, GetParamsID };
