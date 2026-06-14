# Production image: custom Node server (Next + Socket.IO)
FROM node:20-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json* ./
# Build + runtime both need devDependencies (TypeScript/Tailwind for build,
# tsx + TS sources for the custom server), so force-include them.
RUN npm ci --include=dev

COPY . .
RUN npm run build && chmod +x scripts/docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Runs migrations then execs the server so SIGTERM reaches Node for graceful shutdown.
CMD ["sh", "scripts/docker-entrypoint.sh"]
