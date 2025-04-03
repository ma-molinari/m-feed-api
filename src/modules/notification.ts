import { FastifyReply, FastifyRequest } from "fastify";

export enum SSE_EVENTS {
  CREATE_POST = "create-post",
  DELETE_POST = "delete-post",
  CREATE_COMMENT = "create-comment",
  DELETE_COMMENT = "delete-comment",
}

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

  reply.raw.write(`data: ${JSON.stringify({ event: "connect" })}\n\n`);

  clients.add(reply);

  reply.raw.on("close", () => {
    clients.delete(reply);
  });
}

export function notify(event: SSE_EVENTS, content: Record<string, any>) {
  const payload = JSON.stringify({ event, data: content });
  for (const client of clients) {
    client.raw.write(`data: ${payload}\n\n`);
  }
}