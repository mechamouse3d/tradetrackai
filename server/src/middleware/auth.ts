import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
      auth0Id?: string;
    }
  }
}

/**
 * Middleware to verify Auth0 JWT token from frontend.
 * The frontend should send the token in Authorization header: "Bearer <token>"
 */
export const authMiddleware = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    console.error('Auth failed: missing or invalid auth header');
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.substring(7);

  try {
    // For development: decode without verification (Auth0 token signature verification)
    // In production, you should verify the signature using Auth0 public keys
    const decoded: any = jwt.decode(token);

    if (!decoded || !decoded.sub) {
      console.error('Auth failed: invalid token structure');
      return res.status(401).json({ error: 'Invalid token' });
    }

    // Extract Auth0 user ID (sub claim)
    req.auth0Id = decoded.sub;
    console.log('Auth successful for:', req.auth0Id);
    next();
  } catch (error) {
    console.error('Auth failed:', error);
    return res.status(401).json({ error: 'Invalid token', details: (error as any).message });
  }
};
