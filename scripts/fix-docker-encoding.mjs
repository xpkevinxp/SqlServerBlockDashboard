import fs from "fs";
import path from "path";

const root = path.resolve(".");

const files = {
  ".dockerignore": `node_modules
.next
.env
.env.local
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.git
.gitignore
README.md
Dockerfile
docker-compose.yaml
*.md
`,
  Dockerfile: `FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \\
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \\
  CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1

CMD ["node", "server.js"]
`,
};

for (const [name, content] of Object.entries(files)) {
  const filePath = path.join(root, name);
  fs.writeFileSync(filePath, content, { encoding: "utf8" });
  console.log(`fixed ${name}`);
}
