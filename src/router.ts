import { FastifyInstance } from "fastify";

import { login, register } from "@modules/auth";
import {
  follow,
  me,
  search,
  unfollow,
  updatePassword,
  updateProfile,
} from "@modules/user";
import { createPost, explore, feed, getPost } from "@modules/post";

export async function publicRouter(fastify: FastifyInstance) {
  /**
   * Auth Routes
   */
  fastify.post("/login", login);
  fastify.post("/register", register);
}

export async function privateRouter(fastify: FastifyInstance) {
  /**
   * User Routes
   */
  fastify.get("/users/me", me);
  fastify.put("/users/profile", updateProfile);
  fastify.patch("/users/password", updatePassword);
  fastify.get("/users/search", search);
  fastify.post("/users/follow", follow);
  fastify.post("/users/unfollow", unfollow);

  /**
   * Post Routes
   */
  fastify.post("/posts", createPost);
  fastify.get("/posts/:id", getPost);
  fastify.get("/posts/feed", feed);
  fastify.get("/posts/explore", explore);
}
