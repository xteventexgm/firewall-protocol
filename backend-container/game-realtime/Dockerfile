# Contexto de build: raíz del repositorio (ver docker-compose.yml).
FROM node:20-alpine

WORKDIR /app

COPY backend-container/identity/package.json backend-container/identity/package-lock.json ./backend-container/identity/
COPY backend-container/identity/tsconfig.json ./backend-container/identity/
COPY backend-container/identity/src ./backend-container/identity/src
RUN cd backend-container/identity && npm ci --include=dev

COPY backend-container/game-realtime/package.json backend-container/game-realtime/package-lock.json ./backend-container/game-realtime/
COPY backend-container/game-realtime/tsconfig.json ./backend-container/game-realtime/
COPY backend-container/game-realtime/src ./backend-container/game-realtime/src
RUN cd backend-container/game-realtime && npm ci --include=dev

WORKDIR /app/backend-container/game-realtime

EXPOSE 3001

ENV DOCKER=1
ENV NODE_ENV=production
ENV PORT=3001

CMD ["npm", "start"]
