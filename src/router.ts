import { FastifyInstance } from "fastify";

import AuthRoutes from "@modules/auth";
import UserRoutes from "@modules/user";

export async function publicRouter(fastify: FastifyInstance) {
  fastify.register(AuthRoutes);
}

export async function privateRouter(fastify: FastifyInstance) {
  fastify.register(UserRoutes);
}
