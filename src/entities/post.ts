import { Post } from "@prisma/client";

interface GetPostProps {
  Params: {
    id: string;
  };
}

interface CreatePostProps {
  Body: Pick<Post, "content" | "image">;
}

export type { GetPostProps, CreatePostProps };
