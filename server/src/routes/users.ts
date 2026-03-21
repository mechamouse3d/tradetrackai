import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { authMiddleware } from '../middleware/auth.js';

export const userRoutes = (prisma: PrismaClient) => {
  const router = Router();

  /**
   * POST /api/users/sync
   * Sync or create user from Auth0 info on first login
   */
  router.post('/sync', authMiddleware, async (req: Request, res: Response) => {
    try {
      const { email, name, photoURL } = req.body;
      const auth0Id = req.auth0Id;

      if (!auth0Id || !email) {
        return res.status(400).json({ error: 'Missing auth0Id or email' });
      }

      // Upsert user
      const user = await prisma.user.upsert({
        where: { auth0Id },
        update: {
          email,
          name: name || 'User',
          photoURL: photoURL || undefined,
        },
        create: {
          auth0Id,
          email,
          name: name || 'User',
          photoURL: photoURL || undefined,
        },
      });

      res.json({
        success: true,
        user: {
          id: user.id,
          auth0Id: user.auth0Id,
          email: user.email,
          name: user.name,
          photoURL: user.photoURL,
        },
      });
    } catch (error) {
      console.error('Error syncing user:', error);
      res.status(500).json({ error: 'Failed to sync user' });
    }
  });

  /**
   * GET /api/users/me
   * Get current authenticated user info
   */
  router.get('/me', authMiddleware, async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { auth0Id: req.auth0Id },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      res.json({
        id: user.id,
        auth0Id: user.auth0Id,
        email: user.email,
        name: user.name,
        photoURL: user.photoURL,
      });
    } catch (error) {
      console.error('Error fetching user:', error);
      res.status(500).json({ error: 'Failed to fetch user' });
    }
  });

  return router;
};
