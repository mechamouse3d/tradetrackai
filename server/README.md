# TradeTrackAI Server

Backend API server for TradeTrackAI with PostgreSQL database.

## Setup

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure Environment

Copy `.env.example` to `.env` and update values:

```bash
cp .env.example .env
```

Example `.env`:
```
DATABASE_URL="postgresql://postgres:password@localhost:5432/tradetrack_ai_db"
PORT=5000
NODE_ENV=development
JWT_SECRET="dev-secret-key"
AUTH0_DOMAIN="your-domain.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
```

### 3. Setup PostgreSQL Database

**Option A: Local PostgreSQL**

```bash
# Install PostgreSQL if needed (macOS)
brew install postgresql@15

# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb tradetrack_ai_db

# Verify connection
psql tradetrack_ai_db -c "SELECT 1;"
```

**Option B: Docker**

```bash
docker run -d \
  --name postgres-tradetrack \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tradetrack_ai_db \
  -p 5432:5432 \
  postgres:15-alpine
```

### 4. Run Prisma Migrations

```bash
npm run prisma:generate
npm run prisma:migrate
```

This creates the database schema (User, Transaction, PriceCache tables).

### 5. Start the Server

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

Server runs on `http://localhost:5000`

## API Endpoints

### User Management
- `POST /api/users/sync` - Sync user from Auth0 (called on first login)
- `GET /api/users/me` - Get current user info

### Transactions (Authenticated)
- `GET /api/transactions` - Fetch all user transactions
- `POST /api/transactions` - Create new transaction
- `POST /api/transactions/sync` - Bulk sync transactions
- `DELETE /api/transactions/:id` - Delete transaction

### Prices (Authenticated)
- `GET /api/prices` - Get cached prices
- `POST /api/prices/sync` - Bulk sync prices

## Authentication

All protected endpoints require an `Authorization` header with Auth0 JWT token:

```
Authorization: Bearer <auth0_token>
```

The token is automatically sent from the frontend via the Auth0 React SDK.

## Database Schema

### User
- `id` - Unique ID
- `auth0Id` - Auth0 user ID (unique)
- `email` - User email
- `name` - User name
- `photoURL` - Avatar URL
- `createdAt`, `updatedAt` - Timestamps

### Transaction
- `id` - Unique ID
- `userId` - Foreign key to User
- `date` - ISO date string
- `type` - 'BUY' or 'SELL'
- `account` - TFSA, RRSP, etc.
- `exchange` - NASDAQ, TSX, etc.
- `symbol` - Stock ticker
- `name` - Company name
- `shares` - Number of shares
- `price` - Price per share
- `currency` - USD, CAD, etc.
- `createdAt`, `updatedAt`

### PriceCache
- `id` - Unique ID
- `userId` - Foreign key to User
- `symbol` - Stock ticker
- `price` - Current price
- `timestamp`, `updatedAt`

## Prisma Commands

```bash
# Open Prisma Studio (GUI for database)
npm run prisma:studio

# Create a new migration after schema changes
npm run prisma:migrate -- --name migration_name

# Generate Prisma client (usually automatic)
npm run prisma:generate
```

## Debugging

Enable debug logs:
```bash
DEBUG=* npm run dev
```

Check database directly:
```bash
psql tradetrack_ai_db
\dt  # List tables
SELECT * FROM "User";
```

## Deployment

### Heroku (with PostgreSQL)

```bash
# Create Heroku app
heroku create tradetrack-ai-api

# Add PostgreSQL addon
heroku addons:create heroku-postgresql:hobby-dev

# Deploy
git push heroku main

# Run migrations on Heroku
heroku run npm run prisma:migrate
```

### Docker

```bash
docker build -t tradetrack-api .
docker run -e DATABASE_URL="postgresql://..." -p 5000:5000 tradetrack-api
```

## Troubleshooting

**Error: "connect ECONNREFUSED 127.0.0.1:5432"**
- PostgreSQL not running. Check `brew services list` or Docker

**Error: "User not found. Call /api/users/sync first."**
- Frontend needs to call `/api/users/sync` after Auth0 login

**Error: "Invalid token"**
- Check Auth0 domain/client ID in `.env`
- Verify token format in frontend

## Frontend Integration

See [../tradetrack-ai/README.md](../tradetrack-ai/README.md) for frontend changes to use this backend.
