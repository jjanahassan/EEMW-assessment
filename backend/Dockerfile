# ---------- build: compile TypeScript ----------
FROM node:22-alpine AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci
COPY tsconfig.json tsconfig.build.json ./
COPY src ./src
RUN npm run build

# ---------- runtime: production dependencies and compiled output only ----------
FROM node:22-alpine AS runtime
ENV NODE_ENV=production \
    UPLOAD_DIR=/data/uploads \
    NPM_CONFIG_UPDATE_NOTIFIER=false
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY --from=build /app/dist ./dist
COPY migrations ./migrations
COPY samples/report.pdf ./samples/report.pdf
COPY docker-entrypoint.sh ./

# The entrypoint may have Windows line endings (CRLF); remove them. Then create the
# uploads folder owned by the non-root user (a new volume inherits this ownership).
RUN sed -i 's/\r$//' docker-entrypoint.sh \
    && mkdir -p /data/uploads \
    && chown -R node:node /data

USER node
EXPOSE 4000
CMD ["sh", "docker-entrypoint.sh"]