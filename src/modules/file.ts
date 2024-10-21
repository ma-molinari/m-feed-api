import { FastifyReply, FastifyRequest } from "fastify";
import fs from "fs";
import util from "util";
import { pipeline } from "stream";
import path from "path";

const pump = util.promisify(pipeline);
const STATIC_PATH = path.join(process.cwd(), "uploads");
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB

export async function uploadFile(request: FastifyRequest, reply: FastifyReply) {
  try {
    const part = await request.file({ limits: { fileSize: MAX_FILE_SIZE } });

    const folderExists = fs.existsSync(STATIC_PATH);
    if (!folderExists) {
      fs.mkdirSync(STATIC_PATH, { recursive: true });
    }

    const filename = `${Date.now()}-${part.filename}`;
    const filepath = path.join(STATIC_PATH, filename);
    await pump(part.file, fs.createWriteStream(filepath));

    if (part.file.truncated) {
      fs.unlinkSync(filepath);
      return reply.code(400).send({ message: "File exceeds 5 MB limit." });
    }

    return reply.code(200).send({ filename, mimetype: part.mimetype });
  } catch (error) {
    console.log(error.message);
    return reply.code(500).send({ message: `Server error!` });
  }
}
