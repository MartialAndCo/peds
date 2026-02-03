FROM node:20-alpine

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Install dependencies (including dev for building)
RUN npm install

# Copy source
COPY tsconfig.json ./
COPY src ./src

# Build TypeScript
RUN npm run build

# Remove dev dependencies to keep image small
RUN npm prune --production

# Expose API port
EXPOSE 3002

# Start service
CMD ["node", "dist/index.js"]
