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

export type { GetParamsID, CreatePostProps, UpdatePostProps };
