# 🚀 Image Feed API – Portfolio Backend

This is the backend API for the [Image Feed Front-end](https://github.com/ma-molinari/m-feed-web), developed as part of a personal portfolio project. Built with **Fastify**, **PostgreSQL**, and **Redis**, it provides a clean and scalable structure for image management and feed data.

## ⚙️ Tech Stack

- ⚡ **[Fastify](https://fastify.io/)** – Fast and low-overhead web framework
- 🐘 **[PostgreSQL](https://www.postgresql.org/)** – Relational database
- 🔥 **[Redis](https://redis.io/)** – In-memory caching layer
- 🧪 **[Prisma ORM](https://www.prisma.io/)** – Type-safe database ORM
- 🧱 **TypeScript** – Typed development for better developer experience
- 🐳 Docker support (optional)

## 📦 Features

- 📷 RESTful API to manage image feed items
- 🚀 High-performance with Fastify
- 💾 Redis caching for fast response times
- 🌱 Scalable architecture and Docker-ready

## 🔐 Environment Variables

Create a `.env` file based on the following template:

```env
DATABASE_URL=postgresql://user:password@localhost:5432/m-feed
REDIS_PORT=6379
REDIS_HOST=localhost
JWT_KEY=your_key
JWT_EXPIRY_SECONDS=3600000
```

## 🚀 Getting Started

To run the project locally:

```bash
# Clone the repository
git clone https://github.com/ma-molinari/m-feed-api.git

# Enter the project directory
cd m-feed-api

# Install dependencies
npm install

# Run database migrations
npx prisma migrate dev

# Start the dev server
npm run dev
```