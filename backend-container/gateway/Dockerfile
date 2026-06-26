FROM node:20-alpine

WORKDIR /app

COPY package.json package-lock.json* ./
RUN npm ci --include=dev 2>/dev/null || npm install --include=dev

COPY tsconfig.json ./
COPY src ./src

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

CMD ["npm", "start"]
