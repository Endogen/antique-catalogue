# syntax=docker/dockerfile:1

FROM node:26-alpine AS base
ENV NEXT_TELEMETRY_DISABLED=1
WORKDIR /app

FROM base AS deps
RUN apk add --no-cache libc6-compat
COPY package.json package-lock.json ./
RUN npm ci

FROM base AS builder
ARG NEXT_PUBLIC_IMAGE_MAX_SIZE=2560
ARG NEXT_PUBLIC_IMAGE_QUALITY=0.82
ENV NEXT_PUBLIC_IMAGE_MAX_SIZE=$NEXT_PUBLIC_IMAGE_MAX_SIZE
ENV NEXT_PUBLIC_IMAGE_QUALITY=$NEXT_PUBLIC_IMAGE_QUALITY
RUN apk add --no-cache libc6-compat
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM base AS runner
ENV NODE_ENV=production
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy standalone output
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

CMD ["node", "server.js"]
