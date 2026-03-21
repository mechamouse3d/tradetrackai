# Quick Reference - PostgreSQL Migration

## Files Created/Modified Summary

```
TradeTrackAI/
├── MIGRATION_SUMMARY.md          [📄 NEW] What changed & why
├── INTEGRATION_GUIDE.md          [📄 NEW] Complete setup guide
├── setup.sh                      [📄 NEW] One-command setup
├── docker-compose.yml            [📄 NEW] Docker local dev
│
├── server/                       [📁 NEW] Backend (Express + Prisma + PostgreSQL)
│   ├── src/
│   │   ├── index.ts              [NEW] Main server
│   │   ├── middleware/
│   │   │   └── auth.ts           [NEW] Auth0 verification
│   │   └── routes/
│   │       ├── users.ts          [NEW] User endpoints
│   │       ├── transactions.ts   [NEW] Transaction CRUD
│   │       └── prices.ts         [NEW] Price cache
│   ├── prisma/
│   │   └── schema.prisma         [NEW] Database schema
│   ├── package.json              [NEW]
│   ├── tsconfig.json             [NEW]
│   ├── Dockerfile                [NEW]
│   ├── .env.example              [NEW]
│   └── README.md                 [NEW] Backend docs
│
└── tradetrack-ai/
    ├── .env.example              [MODIFIED] Added VITE_API_URL
    ├── App.tsx                   [MODIFIED] Use dataService instead of localStorage
    ├── contexts/
    │   └── AuthContext.tsx        [MODIFIED] Initialize dataService + user sync
    └── services/
        └── dataService.ts        [NEW] Data abstraction layer
```

## Data Storage Architecture

```
┌─────────────────────────┐
│  React App (Frontend)   │
│                         │
│  Demo User (No Auth)    │  Authenticated User (Auth0)
│  ↓                      │  ↓
│  dataService            │  dataService
│  ↓                      │  ↓
│  localStorage           │  API Server
│  ↓                      │  ↓
│  Browser Storage        │  PostgreSQL
│                         │
└─────────────────────────┘
```

## Backend Routes

### Auth (Public)
```
POST   /api/users/sync                    (called on Auth0 login)
GET    /api/users/me                      (get user profile)
```

### Transactions (Protected)
```
GET    /api/transactions                  (fetch all)
POST   /api/transactions                  (create single)
POST   /api/transactions/sync             (bulk sync)
DELETE /api/transactions/:id              (delete)
```

### Prices (Protected)
```
GET    /api/prices                        (fetch cached prices)
POST   /api/prices/sync                   (update prices)
```

All protected routes require: `Authorization: Bearer <auth0_token>`

## Environment Variables

### Backend (`server/.env`)
```bash
DATABASE_URL="postgresql://postgres:password@localhost:5432/tradetrack_ai_db"
PORT=5000
NODE_ENV=development
JWT_SECRET="dev-secret-key"
AUTH0_DOMAIN="your-domain.auth0.com"
AUTH0_CLIENT_ID="your-client-id"
```

### Frontend (`tradetrack-ai/.env.local`)
```bash
VITE_API_URL=http://localhost:5000/api
VITE_AUTH0_DOMAIN=your-domain.auth0.com
VITE_AUTH0_CLIENT_ID=your-client-id
VITE_GOOGLE_API_KEY=your-api-key
```

## Quick Start Commands

### Option 1: Automated (Recommended)
```bash
./setup.sh
# Then in separate terminals:
cd server && npm run dev
cd tradetrack-ai && npm run dev
```

### Option 2: Docker
```bash
docker-compose up
# Frontend runs locally:
cd tradetrack-ai && npm run dev
```

### Option 3: Manual
```bash
# Start PostgreSQL
brew services start postgresql@15

# Create database
createdb tradetrack_ai_db

# Backend
cd server
npm install
npm run prisma:migrate
npm run dev

# Frontend (in another terminal)
cd tradetrack-ai
npm install
npm run dev
```

## Testing Checklist

- [ ] Demo mode (no login)
  - [ ] Add transaction
  - [ ] Refresh page
  - [ ] Transaction persists from localStorage
  
- [ ] Authenticated mode (Auth0 login)
  - [ ] Login with Auth0
  - [ ] Check server logs for `/api/users/sync` success
  - [ ] Add transaction
  - [ ] Check server logs for `/api/transactions/sync`
  - [ ] Refresh page
  - [ ] Transaction persists from PostgreSQL
  
- [ ] Database verification
  - [ ] `psql tradetrack_ai_db`
  - [ ] `SELECT * FROM "User";` (see Auth0 user)
  - [ ] `SELECT * FROM "Transaction";` (see transactions)

## Key Concepts

### dataService Decision Layer
The `dataService` handles all data I/O and decides:
- **If authenticated** → Send to API
- **If demo mode** → Use localStorage

This keeps components simple and storage-agnostic.

### Auth0 Integration
- Frontend gets ID token after Auth0 login
- Token passed to dataService
- Backend verifies token on each protected request
- User ID extracted from token (auth0Id claim)

### Database Queries
- All queries filtered by `userId`
- User can only see their own data
- Enforced at API level + database level

## Deployment Checklist

- [ ] Backend
  - [ ] Deploy to Heroku/Railway/AWS
  - [ ] Set `DATABASE_URL` to production DB
  - [ ] Run `npm run prisma:migrate` on server
  - [ ] Verify API endpoints respond
  
- [ ] Frontend
  - [ ] Update `VITE_API_URL` to production backend
  - [ ] Deploy to Vercel/Netlify
  - [ ] Verify Auth0 callback URLs updated
  - [ ] Test login flow in production

- [ ] Database
  - [ ] Use managed PostgreSQL (RDS, Heroku addon, etc.)
  - [ ] Enable backups
  - [ ] Monitor performance

## Common Issues & Fixes

| Issue | Cause | Fix |
|-------|-------|-----|
| "Database connection refused" | PostgreSQL not running | `brew services start postgresql@15` |
| "User not found" | User sync didn't complete | Check server logs for `/api/users/sync` |
| "Invalid token" | Auth0 token format wrong | Verify `VITE_AUTH0_DOMAIN` and `CLIENT_ID` |
| "CORS error" | Frontend origin not allowed | Check CORS config in `server/src/index.ts` |
| "Data not persisting" | Still using localStorage instead of API | Verify `dataService.initialize()` was called |

## Documentation Files

1. **MIGRATION_SUMMARY.md** - Overview of all changes
2. **INTEGRATION_GUIDE.md** - Complete step-by-step setup
3. **server/README.md** - Backend-specific docs
4. **This file** - Quick reference

## Architecture Diagram

```
User
 ↓
┌─────────────────────────────────┐
│ AuthContext.tsx                 │
│ - Detects Auth0 login           │
│ - Gets ID token                 │
│ - Calls dataService.initialize()│
│ - Calls dataService.syncUser()  │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ App.tsx                         │
│ - Calls dataService.load*()     │
│ - Auto-saves via dataService    │
└─────────────────────────────────┘
           ↓
┌─────────────────────────────────┐
│ dataService.ts (Decision Layer) │
│                                 │
│ if authenticated:               │
│   → Call API                    │
│ else:                           │
│   → Use localStorage            │
└─────────────────────────────────┘
      ↙              ↖
    API            localStorage
     ↓                  ↓
PostgreSQL        Browser Storage
```

## Performance Notes

- **Demo Mode**: ~5ms (localStorage)
- **Authenticated**: ~50-200ms (API + database)
- Price cache synced on app startup only
- Transactions auto-saved after state changes

## Security Notes

✅ Implemented:
- Auth0 JWT verification
- User ID extraction from token
- Query filtering by userId
- CORS protection

⚠️ TODO:
- Add rate limiting
- Add HTTPS in production
- Add request validation
- Add error logging
- Add database backups
- Add monitoring

## Support Resources

- Prisma: https://www.prisma.io/docs/
- Express: https://expressjs.com/
- PostgreSQL: https://www.postgresql.org/docs/
- Auth0: https://auth0.com/docs/
- TypeScript: https://www.typescriptlang.org/docs/

---

**Last Updated:** March 2026
**Status:** Ready for Testing ✅
