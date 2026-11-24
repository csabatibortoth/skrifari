# Skrifari API image. Build from the repository root: docker build -t skrifari-api .
FROM node:24-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/admin/package.json apps/admin/
RUN npm ci --omit=dev --ignore-scripts -w @skrifari/api -w @skrifari/admin && npm cache clean --force

FROM node:24-alpine
ENV NODE_ENV=production
WORKDIR /app
# Licence files travel with the image (Apache-2.0 section 4).
COPY LICENSE NOTICE THIRD_PARTY_NOTICES.md ./
COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY apps/api ./apps/api
COPY apps/admin ./apps/admin
# Never ship local secrets or tests: .dockerignore keeps .env, .git and node_modules out of the context.
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=3s --start-period=10s CMD wget -qO- http://127.0.0.1:3000/health >/dev/null || exit 1
CMD ["node", "apps/api/src/server.js"]
