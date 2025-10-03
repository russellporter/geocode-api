FROM node:22-slim

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install all dependencies (needed for build)
RUN npm ci

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Copy integration test file
COPY integration-test.js ./

# Remove dev dependencies and source files
RUN npm prune --production && \
    rm -rf src tsconfig.json

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
