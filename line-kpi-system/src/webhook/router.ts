import { Router, Request, Response } from 'express';
import { WebhookRequestBody } from '@line/bot-sdk';
import { verifyLineSignature } from './signature';
import { dispatchEvents } from './handler';
import { oaRegistry } from '../services/OaRegistry';

const webhookRouter = Router();

/**
 * POST /webhook/:channelId
 *
 * Receives LINE webhook events for a specific OA channel.
 * Responds 200 immediately — processing happens asynchronously.
 * Group routing is resolved per-event by GroupRegistry (keyed on lineGroupId).
 */
webhookRouter.post('/:channelId', verifyLineSignature, (req: Request, res: Response) => {
  // Respond 200 immediately so LINE does not retry
  res.status(200).send('OK');

  const oa = oaRegistry.getByChannelId(req.params.channelId);
  if (!oa) return; // verifyLineSignature already guards this — defensive check

  const body = req.body as WebhookRequestBody;
  if (!body?.events?.length) return;

  // Async — do not await (response already sent)
  dispatchEvents(body.events, oa._id, oa.channelAccessToken).catch((err) => {
    console.error('[WebhookRouter] Unhandled dispatch error:', err);
  });
});

export { webhookRouter };
