import { Post } from "@prisma/client";

interface GetParamsID {
  Params: {
    id: string;
  };
}

interface CreatePostProps {
  Body: Pick<Post, "content" | "image">;
}

interface UpdatePostProps extends GetParamsID {
  Body: Pick<Post, "content">;
}

interface LikePostProps {
  Body: {
    postId: number;
  };
}

export type { GetParamsID, CreatePostProps, UpdatePostProps, LikePostProps };
