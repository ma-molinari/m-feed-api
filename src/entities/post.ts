import { Post as PostModel, User as UserModel } from "@prisma/client";

interface Post extends PostModel {
  total_likes: number;
  total_comments: number;
  user?: UserModel;
}

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

export type {
  Post,
  GetParamsID,
  CreatePostProps,
  UpdatePostProps,
  LikePostProps,
};
