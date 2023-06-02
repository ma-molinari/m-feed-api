import { FastifyInstance } from "fastify";

import { login, register } from "@modules/auth";
import {
  follow,
  me,
  unfollow,
  updatePassword,
  updateProfile,
} from "@modules/user";
import { explore, feed, getPost, search } from "@modules/post";

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
  fastify.post("/users/follow", follow);
  fastify.post("/users/unfollow", unfollow);

  /**
   * Post Routes
   */
  fastify.get("/feed", feed);
  fastify.get("/explore", explore);
  fastify.get("/search", search);
  fastify.get("/p/:id", getPost);
}
