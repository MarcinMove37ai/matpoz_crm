# Etap budowania
FROM node:20-alpine AS builder

WORKDIR /app

# Instalacja dodatkowych narzędzi
RUN apk add --no-cache libc6-compat

# Instalacja zależności
COPY package*.json ./
RUN npm ci

# Kopiowanie kodu źródłowego
COPY . .

# Ustawienie zmiennych środowiskowych
ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

# Budowanie aplikacji
RUN npm run build

# Etap produkcyjny
FROM node:20-alpine AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Instalacja curl do health checków
RUN apk add --no-cache curl

# Kopiowanie niezbędnych plików
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Ustawienie użytkownika non-root
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs
RUN chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:3000/health || exit 1

CMD ["node", "server.js"]