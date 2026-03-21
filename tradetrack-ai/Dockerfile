# Development Dockerfile - runs dev server
FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Install with legacy-peer-deps to handle dependency conflicts
RUN npm install --legacy-peer-deps

COPY . .

EXPOSE 5173

# Run dev server with --host to allow external connections
CMD ["npm", "run", "dev", "--", "--host"]