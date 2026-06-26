FROM node:18-alpine

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --include=dev

COPY tsconfig.json ./
COPY src ./src
COPY scripts ./scripts

EXPOSE 3000

ENV DOCKER=1
ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
