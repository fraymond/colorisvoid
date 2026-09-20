# better-sqlite3 is a native module; musl (alpine) usually has no prebuilt
# binary for it, so this stage needs real build tools to compile from source.
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package.json package-lock.json ./
RUN npm ci --omit=dev

FROM node:20-alpine AS runner
WORKDIR /app
# espeak-ng is the real IPA phonemizer the server shells out to.
RUN apk add --no-cache espeak-ng
ENV NODE_ENV=production
ENV PORT=8080

COPY --from=deps /app/node_modules ./node_modules
COPY package.json ./
COPY server.js db.js ./
COPY public ./public

EXPOSE 8080
CMD ["node", "server.js"]
