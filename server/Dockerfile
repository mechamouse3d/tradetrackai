FROM node:20-alpine

WORKDIR /app

# Install OpenSSL for Prisma
RUN apk add --no-cache openssl

COPY package*.json ./

# Install all dependencies including devDependencies (needed for tsx in dev mode)
RUN npm install

COPY src ./src
COPY prisma ./prisma
COPY tsconfig.json ./

# Generate Prisma client
RUN npx prisma generate

EXPOSE 5001

CMD ["npm", "run", "dev"]
