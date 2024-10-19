import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import authSession from "@middlewares/authSession";
import { privateRouter, publicRouter } from "./router";

const server: FastifyInstance = Fastify({
  logger: true,
});

server.register(cors);
server.register(multipart);
server.register(publicRouter, { prefix: "public" });
server.register(privateRouter, { prefix: "api" });
server.addHook("onRequest", authSession);

const start = async () => {
  try {
    await server.listen({ port: 8080 });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
