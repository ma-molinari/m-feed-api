import { User } from "@prisma/client";
import { PaginationProps } from "./pagination";

interface UpdateUserProps {
  Body: Pick<User, "email" | "username" | "fullName" | "avatar" | "bio">;
}

interface UpdatePasswordProps {
  Body: Pick<User, "password"> & { newPassword: string };
}

interface FollowUserProps {
  Body: {
    userId: number;
  };
}

interface GetUserProps {
  Params: {
    id: string;
  };
}

interface GetUserPostsProps extends PaginationProps {
  Params: {
    id: string;
  };
}

interface SearchUserProps {
  Querystring: {
    limit: string;
    query: string;
  };
}

export type {
  UpdateUserProps,
  UpdatePasswordProps,
  FollowUserProps,
  GetUserProps,
  GetUserPostsProps,
  SearchUserProps,
};
