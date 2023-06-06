import { User } from "@prisma/client";

interface LoginProps {
  Body: Pick<User, "email" | "password">;
}

interface RegisterProps {
  Body: Pick<User, "email" | "username" | "fullName" | "password">;
}

export type { LoginProps, RegisterProps };
