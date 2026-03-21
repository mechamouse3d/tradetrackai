# TradeTrackAI - PostgreSQL Database Integration Guide

This guide explains how to set up TradeTrackAI with PostgreSQL for authenticated users while keeping demo mode browser-based.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│           React Frontend                    │
│  (handles Auth0 + demo mode)                │
│                                             │
│  ┌──────────────────────────────────────┐  │
│  │ App.tsx                              │  │
│  │ - Loads transactions/prices          │  │
│  │ - Auto-saves on change               │  │
│  └──────────────────────────────────────┘  │
│                  ↓↑                        │
│  ┌──────────────────────────────────────┐  │
│  │ dataService.ts (decision layer)      │  │
│  │ - IF authenticated → use API         │  │
│  │ - IF demo mode → use localStorage    │  │
│  └──────────────────────────────────────┘  │
└─────────────────────────────────────────────┘
                    ↓↑
         ┌──────────────────────┐
         │  Express Server      │
         │  :5000               │
         │                      │
         │  /api/transactions   │
         │  /api/prices         │
         │  /api/users          │
         └──────────────────────┘
                    ↓↑
         ┌──────────────────────┐
         │  PostgreSQL          │
         │  tradetrack_ai_db    │
         │                      │
         │  - User              │
         │  - Transaction       │
         │  - PriceCache        │
         └──────────────────────┘
```

## Data Flow

### Demo Mode (Not Authenticated)
```
User logs into demo
    ↓
App.tsx calls dataService.loadTransactions(userId)
    ↓
dataService checks: isAuthenticated? NO
    ↓
Loads from localStorage (client-side only)
    ↓
User adds transaction
    ↓
App.tsx calls dataService.saveTransactions()
    ↓
Saves to localStorage (instant, no network)
```

### Authenticated Mode (Auth0 User)
```
User logs in with Auth0
    ↓
AuthContext gets ID token + user info
    ↓
Calls dataService.syncUser() → POST /api/users/sync
    ↓
Backend creates/updates user in PostgreSQL
    ↓
dataService.initialize({ isAuthenticated: true, token })
    ↓
App.tsx loads data via dataService.loadTransactions()
    ↓
dataService detects isAuthenticated: YES
    ↓
Fetches from API → GET /api/transactions
    ↓
Backend queries PostgreSQL
    ↓
User adds transaction
    ↓
App.tsx calls dataService.saveTransactions()
    ↓
dataService syncs via API → POST /api/transactions/sync
    ↓
Backend writes to PostgreSQL
```

## Setup Steps

### 1. Backend Setup

#### Start PostgreSQL
```bash
# macOS with Homebrew
brew install postgresql@15
brew services start postgresql@15

# Or use Docker
docker run -d \
  --name postgres \
  -e POSTGRES_PASSWORD=password \
  -e POSTGRES_DB=tradetrack_ai_db \
  -p 5432:5432 \
  postgres:15-alpine
```

#### Initialize Backend
```bash
cd server
npm install
cp .env.example .env

# Update .env with your database URL:
# DATABASE_URL="postgresql://postgres:password@localhost:5432/tradetrack_ai_db"
```

#### Create Database Schema
```bash
npm run prisma:generate
npm run prisma:migrate
```

This creates three tables:
- **User** - Auth0 users synced from frontend
- **Transaction** - User's buy/sell transactions
- **PriceCache** - Stock price snapshots

#### Start Backend Server
```bash
npm run dev
# Server runs on http://localhost:5000
```

### 2. Frontend Setup

```bash
cd tradetrack-ai
npm install

# Copy environment template
cp .env.example .env.local

# Update .env.local:
# VITE_API_URL=http://localhost:5000/api
# VITE_AUTH0_DOMAIN=your-domain.auth0.com
# VITE_AUTH0_CLIENT_ID=your-client-id
# VITE_GOOGLE_API_KEY=your-api-key
```

#### Start Frontend
```bash
npm run dev
# App runs on http://localhost:5173
```

## Testing the Flow

### Test 1: Demo Mode (No Login)

1. Open http://localhost:5173
2. Click "Trade Tracking" → "Enter as Guest"
3. Add a transaction
4. Refresh page → **Transaction persists** (localStorage)
5. Open browser DevTools → Application → localStorage → `transactions_<id>`

### Test 2: Authenticated Mode (Auth0 Login)

1. Open http://localhost:5173
2. Click "Login" → Select "Google" or "Email"
3. Complete Auth0 login
4. App calls `/api/users/sync` → Check server logs for success
5. Add a transaction
6. App calls `/api/transactions/sync` → Check server logs
7. Refresh page → **Transaction persists** (PostgreSQL)
8. Check database:
```bash
psql tradetrack_ai_db
SELECT * FROM "Transaction" WHERE "userId" = '<user-id>';
```

### Test 3: User Sync

Check that user was created:
```bash
psql tradetrack_ai_db
SELECT * FROM "User";
```

You should see the Auth0 user info.

## Database Schema

### User Table
```sql
CREATE TABLE "User" (
  id         STRING (CUID)      -- Prisma auto-generated ID
  auth0Id    STRING (UNIQUE)    -- From Auth0 (e.g., auth0|123abc)
  email      STRING (UNIQUE)    -- From Auth0
  name       STRING             -- Display name
  photoURL   STRING             -- Avatar URL
  createdAt  TIMESTAMP          -- Auto
  updatedAt  TIMESTAMP          -- Auto
);
```

### Transaction Table
```sql
CREATE TABLE "Transaction" (
  id         STRING (CUID)
  userId     STRING (FK)        -- References User.id
  date       STRING             -- ISO date (2024-03-15)
  type       STRING             -- 'BUY' or 'SELL'
  account    STRING             -- TFSA, RRSP, etc.
  exchange   STRING             -- NASDAQ, TSX, etc.
  symbol     STRING             -- Stock ticker (AAPL, GOOGL)
  name       STRING             -- Company name
  shares     FLOAT              -- Quantity
  price      FLOAT              -- Price per share
  currency   STRING             -- USD, CAD, etc.
  createdAt  TIMESTAMP          -- Auto
  updatedAt  TIMESTAMP          -- Auto
};
```

### PriceCache Table
```sql
CREATE TABLE "PriceCache" (
  id         STRING (CUID)
  userId     STRING (FK)        -- References User.id
  symbol     STRING             -- Stock ticker
  price      FLOAT              -- Current price
  timestamp  TIMESTAMP          -- When fetched
  updatedAt  TIMESTAMP          -- Auto
  
  CONSTRAINT unique_user_symbol UNIQUE(userId, symbol)
};
```

## API Endpoints

### Authentication Required
All endpoints except `/health` and `/users/sync` (first time) require:
```
Authorization: Bearer <auth0_id_token>
```

### Public
- `GET /api/health` - Server status

### Users
- `POST /api/users/sync` - Create/update user (called on Auth0 login)
- `GET /api/users/me` - Get current user info

### Transactions
- `GET /api/transactions` - Fetch all user's transactions
- `POST /api/transactions` - Create single transaction
- `POST /api/transactions/sync` - Bulk sync transactions
- `DELETE /api/transactions/:id` - Delete transaction

### Prices
- `GET /api/prices` - Get all cached prices
- `POST /api/prices/sync` - Bulk sync prices

## Common Issues

### "Database connection error"
- Check PostgreSQL is running: `psql -d tradetrack_ai_db -c "SELECT 1;"`
- Verify `DATABASE_URL` in `server/.env`
- Check Prisma schema: `npm run prisma:studio`

### "User not found. Call /api/users/sync first."
- Frontend didn't complete user sync after Auth0 login
- Check Auth0 token is being retrieved: `getIdTokenClaims()` in AuthContext
- Check server logs for `/users/sync` POST request

### "Invalid token"
- Auth0 token format is wrong
- Check `VITE_AUTH0_DOMAIN` and `VITE_AUTH0_CLIENT_ID` in frontend `.env.local`
- Frontend should send: `Authorization: Bearer <token>` (with space)

### "CORS error"
- Frontend and backend domains don't match
- Check CORS config in `server/src/index.ts`
- For development: should allow `http://localhost:5173`

### Data still in localStorage?
- Demo mode always uses localStorage
- For authenticated users, it fetches from API (not localStorage)
- To switch from demo to auth, logout and login with Auth0

## Deployment

### Backend (Heroku)

```bash
# Create app
heroku create tradetrack-api

# Add PostgreSQL
heroku addons:create heroku-postgresql:hobby-dev

# Get DATABASE_URL from addon
heroku config

# Set environment variables
heroku config:set JWT_SECRET="your-prod-secret"
heroku config:set NODE_ENV=production

# Deploy
git push heroku main

# Run migrations
heroku run npm run prisma:migrate
```

### Frontend (Vercel/Netlify)

```bash
# Update VITE_API_URL to production backend
# VITE_API_URL=https://tradetrack-api.herokuapp.com/api

# Deploy
vercel deploy
# or
netlify deploy
```

### Docker Compose (Local All-in-One)

```bash
# Build both services
docker-compose build

# Start
docker-compose up

# Access:
# Frontend: http://localhost:3000
# Backend: http://localhost:5000
# Postgres: localhost:5432
```

## Debugging

### View database with Prisma Studio
```bash
cd server
npm run prisma:studio
# Opens GUI at http://localhost:5555
```

### Check transactions in database
```bash
psql tradetrack_ai_db
SELECT * FROM "Transaction" ORDER BY "createdAt" DESC LIMIT 10;
```

### Check user sync
```bash
SELECT * FROM "User";
```

### Check price cache
```bash
SELECT * FROM "PriceCache";
```

### View API logs
```bash
# Terminal running `npm run dev` in server/
# Shows all requests: POST /api/transactions, etc.
```

### Frontend logs
```
// Browser console (F12)
// Check for errors in dataService calls
// Look for fetch() responses
```

## Performance Notes

- **Demo mode**: Instant reads/writes (localStorage)
- **Authenticated mode**: Network latency (API calls)
- **Price cache**: Synced on app startup + on manual refresh
- **Transaction sync**: Debounced to avoid too many API calls

## Security Considerations

- ✅ Auth0 tokens verified on backend (implement in production)
- ✅ User ID isolation (queries filtered by `userId`)
- ✅ Timestamps recorded for audit trail
- ⚠️ TODO: Add rate limiting to API
- ⚠️ TODO: Add HTTPS in production
- ⚠️ TODO: Hash sensitive data

## Next Steps

1. [ ] Test demo mode (no Auth0)
2. [ ] Test authenticated mode (with Auth0)
3. [ ] Set up production PostgreSQL (RDS, Heroku, etc.)
4. [ ] Deploy backend to production
5. [ ] Update frontend API URL to production
6. [ ] Set up monitoring (logs, errors, uptime)
7. [ ] Add rate limiting to API endpoints
8. [ ] Implement token refresh logic
