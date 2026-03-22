import crypto from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { oaRegistry } from '../services/OaRegistry';

/**
 * LINE signature verification middleware.
 * Reads the channelId from req.params, looks up the channel secret,
 * and verifies the X-Line-Signature header.
 * Returns 401 if verification fails. Returns 404 if OA is unknown.
 */
export function verifyLineSignature(req: Request, res: Response, next: NextFunction): void {
  const { channelId } = req.params;
  const oa = oaRegistry.getByChannelId(channelId);

  if (!oa) {
    console.warn(`[Webhook] Unknown channelId: ${channelId}`);
    res.status(404).json({ error: 'Unknown LINE OA channel' });
    return;
  }

  const signature = req.headers['x-line-signature'] as string | undefined;
  if (!signature) {
    res.status(401).json({ error: 'Missing X-Line-Signature header' });
    return;
  }

  const body = (req as Request & { rawBody?: Buffer }).rawBody;
  if (!body) {
    res.status(400).json({ error: 'Raw body not available for signature check' });
    return;
  }

  const expected = crypto
    .createHmac('sha256', oa.channelSecret)
    .update(body)
    .digest('base64');

  if (expected !== signature) {
    console.warn(`[Webhook] Invalid signature for channelId: ${channelId}`);
    res.status(401).json({ error: 'Invalid LINE signature' });
    return;
  }

  // Attach OA context to request for downstream handlers
  (req as Request & { lineOa?: typeof oa }).lineOa = oa;
  next();
}
