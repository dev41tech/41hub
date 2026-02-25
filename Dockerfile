# ----- Build stage -----
FROM node:20-alpine AS build
WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .
RUN npm run build

# ---- Runtime stage ----
FROM node:20-alpine AS runtime
WORKDIR /app

ENV NODE_ENV=production

# deps de runtime
COPY package*.json ./
RUN npm ci --omit=dev

# artefatos
COPY --from=build /app/dist ./dist
COPY --from=build /app/server ./server
COPY --from=build /app/shared ./shared
COPY --from=build /app/drizzle.config.ts ./drizzle.config.ts

# (opcional, mas recomendado) se existir pasta de migrations/artefatos drizzle no repo:
# COPY --from=build /app/drizzle ./drizzle

# uploads persistentes (montados via volume no compose)
RUN mkdir -p /app/uploads

EXPOSE 5000

# seu entrypoint continua igual
CMD ["node", "dist/index.cjs"]