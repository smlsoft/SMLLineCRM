import { Router, Request, Response } from 'express';
import { Types } from 'mongoose';
import { CustomerGroup } from '../../models/CustomerGroup';
import { subscribeGroup, type MessageStreamEvent } from '../../services/MessageStream';

const router = Router();

const PING_MS = 25_000;

/**
 * GET /api/v1/assistant/groups/:groupId/stream   (Server-Sent Events, X-API-Key)
 *
 * Pushes each new message of the CustomerGroup as it is saved by the webhook:
 *   event: message          data: <one item of GET /api/v1/messages>   (new message)
 *   event: message_update   data: <same shape>                         (image media now stored)
 *   id: <message _id>
 * A `: ping` comment every 25 s keeps proxies from closing the connection.
 * No history is replayed: load it with GET /api/v1/messages?groupId= after connecting.
 */
router.get('/:groupId/stream', async (req: Request, res: Response) => {
  const { groupId } = req.params;
  if (!Types.ObjectId.isValid(groupId)) {
    res.status(400).json({ error: 'groupId must be a CustomerGroup _id (24-hex ObjectId)' });
    return;
  }
  const exists = await CustomerGroup.exists({ _id: groupId });
  if (!exists) {
    res.status(404).json({ error: 'Group not found' });
    return;
  }

  res.status(200);
  res.setHeader('Content-Type', 'text/event-stream; charset=utf-8');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // tell proxies not to buffer
  res.flushHeaders();
  req.socket.setKeepAlive(true);
  req.socket.setTimeout(0);

  res.write('retry: 5000\n: connected\n\n');

  const send = (event: MessageStreamEvent, item: unknown) => {
    const id = (item as { _id?: unknown })._id;
    res.write(`event: ${event}\nid: ${String(id)}\ndata: ${JSON.stringify(item)}\n\n`);
  };
  const unsubscribe = subscribeGroup(String(groupId), send);
  const ping = setInterval(() => res.write(': ping\n\n'), PING_MS);

  const cleanup = () => {
    clearInterval(ping);
    unsubscribe();
  };
  req.on('close', cleanup);
  res.on('error', cleanup);
});

export { router as assistantStreamRoutes };
