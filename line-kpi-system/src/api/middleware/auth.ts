import { Request, Response, NextFunction } from 'express';
import { config } from '../../config';

export function apiKeyAuth(req: Request, res: Response, next: NextFunction): void {
  const key =
    req.headers['x-api-key'] ??
    (req.headers['authorization'] ?? '').replace(/^Bearer\s+/i, '');

  if (key !== config.apiKey) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }
  next();
}
