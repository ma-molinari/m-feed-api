import { FastifyInstance } from "fastify";
import { login, register } from "@modules/auth";
import {
  follow,
  getUser,
  getUserFollowers,
  getUserFollowings,
  me,
  search,
  unfollow,
  updatePassword,
  updateProfile,
  usersLikedPost,
  userSuggestions,
} from "@modules/user";
import {
  createPost,
  deletePost,
  explore,
  feed,
  getLikedPostsByMe,
  getPost,
  getUserPosts,
  likePost,
  unlikePost,
  updatePost,
} from "@modules/post";
import {
  createComment,
  deleteComment,
  getComments,
  updateComment,
} from "@modules/comment";
import { uploadFile } from "@modules/file";
import { notificationStream } from "@modules/notification";

export async function publicRouter(fastify: FastifyInstance) {
  /**
   * Auth Routes
   */
  fastify.post("/login", login);
  fastify.post("/register", register);

  /**
   * Notification Routes
   */
  fastify.get("/notifications", notificationStream);
}

export async function privateRouter(fastify: FastifyInstance) {
  /**
   * Me Routes
   */
  fastify.get("/users/me", me);
  fastify.get("/users/me/liked-posts", getLikedPostsByMe);

  /**
   * User Routes
   */
  fastify.get("/users/:id", getUser);
  fastify.get("/users/:id/posts", getUserPosts);
  fastify.get("/users/:id/followers", getUserFollowers);
  fastify.get("/users/:id/followings", getUserFollowings);
  fastify.put("/users/profile", updateProfile);
  fastify.patch("/users/password", updatePassword);
  fastify.get("/users/search", search);
  fastify.get("/users/suggestions", userSuggestions);
  fastify.post("/users/follow", follow);
  fastify.post("/users/unfollow", unfollow);

  /**
   * Post Routes
   */
  fastify.post("/posts", createPost);
  fastify.get("/posts/:id", getPost);
  fastify.put("/posts/:id", updatePost);
  fastify.delete("/posts/:id", deletePost);
  fastify.post("/posts/like", likePost);
  fastify.post("/posts/unlike", unlikePost);
  fastify.get("/posts/:id/users-likes", usersLikedPost);

  /**
   * Feed Routes
   */
  fastify.get("/posts/feed", feed);
  fastify.get("/posts/explore", explore);

  /**
   * Comments Routes
   */
  fastify.post("/posts/:postId/comments", createComment);
  fastify.get("/posts/:postId/comments", getComments);
  fastify.put("/posts/:postId/comments/:commentId", updateComment);
  fastify.delete("/posts/:postId/comments/:commentId", deleteComment);

  /**
   * File Routes
   */
  fastify.post("/file/upload", uploadFile);
}
