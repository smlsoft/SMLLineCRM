FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY tsconfig.json ./
COPY src ./src
RUN npm run build

FROM node:20-alpine
WORKDIR /app
ENV NODE_ENV=production
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
USER node
# Layer 1 worker: checks urgent rooms every POLL_INTERVAL_SEC (default 1800 s).
EXPOSE 3005
CMD ["node", "dist/worker/run-layer1.js", "--loop"]
