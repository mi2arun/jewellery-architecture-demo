FROM node:22-alpine
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
# API base URL is baked at build time (Vite). Defaults to localhost for dev.
ARG VITE_API=http://localhost:3000
ENV VITE_API=$VITE_API
RUN npm run build
EXPOSE 5173
CMD ["npm", "run", "preview"]
