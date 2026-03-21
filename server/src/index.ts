import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import { PrismaClient } from '@prisma/client';
import { transactionRoutes } from './routes/transactions.js';
import { priceRoutes } from './routes/prices.js';
import { userRoutes } from './routes/users.js';
import { authMiddleware } from './middleware/auth.js';

dotenv.config();

const app = express();
const prisma = new PrismaClient();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? 'https://yourdomain.com' // Update this to your production domain
    : ['http://localhost:5173', 'http://localhost:3000'],
  credentials: true
}));
app.use(express.json());

// Health check
app.get('/health', (req: Request, res: Response) => {
  res.json({ status: 'ok', timestamp: new Date() });
});

// Auth routes (public)
app.use('/api/users', userRoutes(prisma));

// Protected routes (require auth)
app.use('/api/transactions', authMiddleware, transactionRoutes(prisma));
app.use('/api/prices', authMiddleware, priceRoutes(prisma));

// Error handling middleware
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  console.error('Error:', err);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { stack: err.stack })
  });
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await prisma.$disconnect();
  process.exit(0);
});

app.listen(PORT, () => {
  console.log(`✨ TradeTrackAI Server running on http://localhost:${PORT}`);
  console.log(`📊 Database connected to PostgreSQL`);
});

export { app, prisma };
