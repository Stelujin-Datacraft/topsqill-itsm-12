FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Placeholder only for `prisma generate` (does not connect / migrate).
ENV VIS_DATABASE_URL="postgresql://build:build@127.0.0.1:5432/build"
# prebuild runs prisma:vis:generate; nest assets copy client into dist/
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
