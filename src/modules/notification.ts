import { FastifyReply, FastifyRequest } from "fastify";

let clients = new Set<FastifyReply>();

export async function notificationStream(
  _request: FastifyRequest,
  reply: FastifyReply,
) {
  const headers = {
    "Access-Control-Allow-Headers": "Content-Type",
    "Access-Control-Allow-Methods": "GET",
    "Access-Control-Allow-Origin": "*",
    'Content-Type': 'text/event-stream',
    Connection: 'keep-alive',
    'Cache-Control': 'no-cache'
  };
  reply.raw.writeHead(200, headers);

  reply.raw.write(`data: ${JSON.stringify({ message: "Connected" })}\n\n`);

  clients.add(reply);

  reply.raw.on("close", () => {
    clients.delete(reply);
  });
}

export function notify(message: Record<string, string>) {
  for (const client of clients) {
    client.raw.write(`data: ${JSON.stringify(message)}\n\n`);
  }
}

setInterval(() => {
  notify({ message: "Hello, world!" });
  console.log("clients: ", clients.size)
}, 5000);