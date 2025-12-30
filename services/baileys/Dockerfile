FROM node:18-alpine

WORKDIR /app

# Install system dependencies
# git is often needed for some npm packages
RUN apk add --no-cache git

COPY package*.json ./
RUN npm install

COPY . .
RUN npm run build

# Expose port (must match index.ts)
EXPOSE 3001

CMD ["npm", "start"]
