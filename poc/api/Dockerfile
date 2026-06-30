FROM node:22-slim
WORKDIR /app

# OpenSSL is required by the Prisma engines.
RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

COPY package.json ./
RUN npm install

COPY . .

# Generate both Prisma clients at build time.
RUN npm run prisma:generate
RUN npm run build

EXPOSE 3000

# On boot: push schemas to both DBs, seed, then start the API.
CMD sh -c "npm run db:push && npm run seed && npm run start"
