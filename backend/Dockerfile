FROM node:22-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# VIS persists via shared Supabase (SUPABASE_URL + SERVICE_ROLE_KEY at runtime).
# No separate VIS_DATABASE_URL / local Postgres required for Nest boot.
RUN npm run build

FROM node:22-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY --from=builder /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
