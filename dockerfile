FROM node:23-slim AS builder

WORKDIR /app

COPY package.json ./
RUN npm install

COPY tsconfig.json ./
COPY src ./src

RUN npx prisma generate --schema=src/db/schema.prisma

RUN npm run build

FROM node:23-slim

WORKDIR /app

RUN apt-get update && apt-get install -y openssl

COPY --from=builder /app/build ./build
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/tsconfig.json ./
COPY --from=builder /app/src/db ./src/db

EXPOSE 3000

CMD ["node", "build/index.js"]