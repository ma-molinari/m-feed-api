import { FastifyInstance } from "fastify";
import { login, register } from "@modules/auth";
import {
  follow,
  getUser,
  me,
  search,
  unfollow,
  updatePassword,
  updateProfile,
} from "@modules/user";
import {
  createPost,
  deletePost,
  explore,
  feed,
  getPost,
  getPostLikes,
  likePost,
  unlikePost,
  updatePost,
} from "@modules/post";

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
  fastify.get("/users/:id", getUser);
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
  fastify.get("/posts/:id/likes", getPostLikes);
  fastify.put("/posts/:id", updatePost);
  fastify.delete("/posts/:id", deletePost);
  fastify.get("/posts/feed", feed);
  fastify.get("/posts/explore", explore);
  fastify.post("/posts/like", likePost);
  fastify.post("/posts/unlike", unlikePost);
}
