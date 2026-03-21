import { Router, Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';

export const transactionRoutes = (prisma: PrismaClient) => {
  const router = Router();

  /**
   * POST /api/transactions/sync
   * Sync all transactions for authenticated user
   */
  router.post('/sync', async (req: Request, res: Response) => {
    try {
      console.log('Transaction sync request from auth0Id:', req.auth0Id);
      const { transactions } = req.body;

      if (!Array.isArray(transactions)) {
        return res.status(400).json({ error: 'Invalid transactions array' });
      }

      console.log(`Syncing ${transactions.length} transactions for user ${req.auth0Id}`);

      // Get or create user by auth0Id
      let user = await prisma.user.findUnique({
        where: { auth0Id: req.auth0Id! },
      });

      if (!user) {
        console.error('User not found for auth0Id:', req.auth0Id);
        return res.status(404).json({ error: 'User not found. Call /api/users/sync first.' });
      }

      // Delete all existing transactions for this user and recreate
      // (simpler than figuring out individual diffs)
      await prisma.transaction.deleteMany({
        where: { userId: user.id },
      });

      // Create new transactions
      const createdTransactions = await prisma.transaction.createMany({
        data: transactions.map((tx: any) => ({
          userId: user!.id,
          date: tx.date,
          type: tx.type,
          account: tx.account,
          exchange: tx.exchange,
          symbol: tx.symbol,
          name: tx.name,
          shares: parseFloat(tx.shares),
          price: parseFloat(tx.price),
          currency: tx.currency,
        })),
      });

      console.log(`Successfully synced ${createdTransactions.count} transactions`);
      res.json({
        success: true,
        synced: createdTransactions.count,
      });
    } catch (error) {
      console.error('Error syncing transactions:', error);
      res.status(500).json({ error: 'Failed to sync transactions' });
    }
  });

  /**
   * GET /api/transactions
   * Fetch all transactions for authenticated user
   */
  router.get('/', async (req: Request, res: Response) => {
    try {
      const user = await prisma.user.findUnique({
        where: { auth0Id: req.auth0Id! },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const transactions = await prisma.transaction.findMany({
        where: { userId: user.id },
        orderBy: { date: 'desc' },
      });

      res.json(transactions);
    } catch (error) {
      console.error('Error fetching transactions:', error);
      res.status(500).json({ error: 'Failed to fetch transactions' });
    }
  });

  /**
   * POST /api/transactions
   * Create a single transaction
   */
  router.post('/', async (req: Request, res: Response) => {
    try {
      const { date, type, account, exchange, symbol, name, shares, price, currency } = req.body;

      const user = await prisma.user.findUnique({
        where: { auth0Id: req.auth0Id! },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      const transaction = await prisma.transaction.create({
        data: {
          userId: user.id,
          date,
          type,
          account,
          exchange,
          symbol,
          name,
          shares: parseFloat(shares),
          price: parseFloat(price),
          currency,
        },
      });

      res.status(201).json(transaction);
    } catch (error) {
      console.error('Error creating transaction:', error);
      res.status(500).json({ error: 'Failed to create transaction' });
    }
  });

  /**
   * DELETE /api/transactions/:id
   * Delete a transaction
   */
  router.delete('/:id', async (req: Request, res: Response) => {
    try {
      const { id } = req.params;

      const user = await prisma.user.findUnique({
        where: { auth0Id: req.auth0Id! },
      });

      if (!user) {
        return res.status(404).json({ error: 'User not found' });
      }

      // Ensure transaction belongs to user
      const transaction = await prisma.transaction.findUnique({
        where: { id },
      });

      if (!transaction || transaction.userId !== user.id) {
        return res.status(403).json({ error: 'Not authorized to delete this transaction' });
      }

      await prisma.transaction.delete({
        where: { id },
      });

      res.json({ success: true, deleted: id });
    } catch (error) {
      console.error('Error deleting transaction:', error);
      res.status(500).json({ error: 'Failed to delete transaction' });
    }
  });

  return router;
};
