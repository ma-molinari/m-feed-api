import session from "@utils/session";

export default async function authSession(request, reply) {
  if (request.url.includes(`/public`)) {
    return null;
  }

  const { authorization } = request.headers;
  const user = await session(authorization);

  if (!user) {
    return reply.code(401).send({ message: `unauthorized` });
  }

  return user;
}
