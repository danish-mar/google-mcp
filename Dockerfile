FROM node:22-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY tsconfig.json ./
COPY src ./src
COPY views ./views
COPY .env.example ./
RUN npm run build

FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=8080

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=builder /app/dist ./dist
COPY --from=builder /app/views ./views
COPY .env.example ./.env.example

EXPOSE 8080

CMD ["node", "dist/index.js"]
