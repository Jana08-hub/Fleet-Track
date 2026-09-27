FROM node:22-bookworm-slim
WORKDIR /app

# Prisma needs openssl on slim images
RUN apt-get update -y && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
COPY prisma ./prisma
RUN npm install && npx prisma generate

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

ENV NODE_ENV=production
EXPOSE 10000
# Render injects $PORT; backend defaults to 4000 so force $PORT
CMD ["sh", "-c", "npx prisma migrate deploy && PORT=${PORT:-10000} node dist/index.js"]
