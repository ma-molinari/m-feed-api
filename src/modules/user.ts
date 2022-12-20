import session from "@utils/session";
import fp from "fastify-plugin";

export default fp(async (fastify, opts) => {
  fastify.get("/users/me", async (request, reply) => {
    try {
      const { authorization } = request.headers;

      const user = await session(authorization);

      return reply.code(200).send({
        data: user,
      });
    } catch (error) {
      return reply.code(500).send({ message: `Server error!` });
    }
  });

  fastify.patch("/users/password", (request, reply) => {
    return reply.code(200).send({ status: "ok" });
  });
});
