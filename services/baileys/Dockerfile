FROM node:20-alpine

WORKDIR /app

# Install system dependencies
# git is needed for npm packages, ffmpeg for voice conversion
RUN apk add --no-cache git ffmpeg && \
    git config --global --add safe.directory /repo

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Expose port (must match index.ts)
EXPOSE 3001

CMD ["npm", "start"]
