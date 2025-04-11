if (process.env.NODE_ENV !== "dev") {
  require("module-alias/register");
}
import Fastify, { FastifyInstance } from "fastify";
import cors from "@fastify/cors";
import multipart from "@fastify/multipart";
import fastifyStatic from "@fastify/static";
import authSession from "@middlewares/authSession";
import path from "path";
import { privateRouter, publicRouter } from "./router";

const server: FastifyInstance = Fastify({
  logger: true,
});

server.register(cors);
server.register(multipart);
server.register(fastifyStatic, {
  root: path.join(process.cwd(), "uploads"),
  prefix: "/static/",
});
server.register(publicRouter, { prefix: "public" });
server.register(privateRouter, { prefix: "api" });
server.addHook("onRequest", authSession);

const start = async () => {
  try {
    await server.listen({ host: "0.0.0.0", port: 8080 });
  } catch (err) {
    server.log.error(err);
    process.exit(1);
  }
};

start();
