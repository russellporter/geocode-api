FROM node:22-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm ci --only=production

# Copy TypeScript config and source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies and source files
RUN npm prune --production && \
    rm -rf src tsconfig.json

# Expose port
EXPOSE 3000

# Start the application
CMD ["node", "dist/index.js"]
