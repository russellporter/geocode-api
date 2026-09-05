FROM node:26-slim AS base

WORKDIR /app

COPY package*.json ./

FROM base AS builder

RUN npm ci

COPY tsconfig.json ./
COPY src ./src

RUN npm run build

FROM builder AS test

COPY scripts ./scripts
COPY test ./test
COPY example-data ./example-data

CMD ["npm", "test"]

FROM base AS production

ENV NODE_ENV=production

RUN npm ci --omit=dev && npm cache clean --force

COPY --from=builder /app/dist ./dist
COPY --chown=node:node scripts ./scripts

RUN mkdir -p /app/data && chown node:node /app/data

USER node

# Expose port
EXPOSE 3000

CMD ["npm", "start"]
