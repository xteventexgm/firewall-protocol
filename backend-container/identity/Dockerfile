FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev 2>/dev/null || npm install --include=dev

COPY tsconfig.json ./
COPY src ./src
COPY assets ./assets

EXPOSE 3002

ENV DOCKER=1
ENV NODE_ENV=production
ENV PORT=3001

CMD ["npm", "start"]
