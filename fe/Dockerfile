# Production image: the Next.js standalone server, non-root.
#
#   docker build --build-arg API_URL=http://api:8080 \
#     --build-arg NEXT_PUBLIC_SITE_URL=https://example.com -t digital-profile-web fe
#
# API_URL is needed at build time (the /api/v1 forwarding is fixed then) and at runtime. The
# API needn't be reachable while building: pages then ask it on their first requests.

FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund

FROM node:24-alpine AS build
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ARG API_URL
ARG NEXT_PUBLIC_SITE_URL
ARG NEXT_PUBLIC_API_URL
ENV NEXT_TELEMETRY_DISABLED=1
RUN test -n "$API_URL" || { echo "API_URL must be set when building" >&2; exit 1; }
RUN npm run build

FROM node:24-alpine
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
CMD ["node", "server.js"]
