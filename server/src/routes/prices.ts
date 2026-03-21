import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export const priceRoutes = (prisma: PrismaClient) => {
  const router = Router();

  /**
   * POST /api/prices/sync
   * Sync current prices for user
   */
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      const { prices } = req.body; // { symbol: price }

      if (typeof prices !== 'object' || prices === null) {
        return res.status(400).json({ error: 'Invalid prices object' });
      }

      const user = await prisma.user.findUnique({
        where: { auth0Id: req.auth0Id! },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Upsert prices for each symbol
      const updates = await Promise.all(
        Object.entries(prices).map(([symbol, price]: [string, any]) =>
          prisma.priceCache.upsert({
            where: {
              userId_symbol: {
                userId: user.id,
                symbol,
              },
            },
            update: {
              price: parseFloat(price),
              timestamp: new Date(),
            },
            create: {
              userId: user.id,
              symbol,
              price: parseFloat(price),
            },
          })
        )
      );

      res.json({
        success: true,
        updated: updates.length,
      });
    } catch (error) {
      console.error('Error syncing prices:', error);
      res.status(500).json({ error: 'Failed to sync prices' });
    }
  });

  /**
   * GET /api/prices
   * Get all cached prices for user
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { auth0Id: req.auth0Id! },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const priceCache = await prisma.priceCache.findMany({
        where: { userId: user.id },
      });

      // Convert to { symbol: price } format
      const prices = priceCache.reduce(
        (acc: Record<string, number>, pc: any) => {
          acc[pc.symbol] = pc.price;
          return acc;
        },
        {} as Record<string, number>
      );

      res.json(prices);
    } catch (error) {
      console.error('Error fetching prices:', error);
      res.status(500).json({ error: 'Failed to fetch prices' });
    }
  });

  return router;
};
