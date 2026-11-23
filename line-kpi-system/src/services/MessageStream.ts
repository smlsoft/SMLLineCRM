import { Types } from 'mongoose';
import { Message } from '../models/Message';

/**
 * In-process fan-out of newly saved messages to live subscribers (the assistant SSE stream).
 *
 * Works because production runs one backend process; with more than one, a message saved in
 * one process would not reach a stream held by another (that would need a shared bus).
 * A group with no subscriber costs nothing: no DB read happens.
 */

export type MessageStreamEvent = 'message' | 'message_update';
export type MessageStreamListener = (event: MessageStreamEvent, item: unknown) => void;

/** Same shape as one item of GET /api/v1/messages. */
export function loadMessageItems(filter: Record<string, unknown>) {
  return Message.find(filter)
    .populate('employeeId', 'name employeeCode')
    .populate('mediaId', 'data url mimeType');
}

const listeners = new Map<string, Set<MessageStreamListener>>();

export function subscribeGroup(groupId: string, listener: MessageStreamListener): () => void {
  let set = listeners.get(groupId);
  if (!set) {
    set = new Set();
    listeners.set(groupId, set);
  }
  set.add(listener);
  return () => {
    const s = listeners.get(groupId);
    if (!s) return;
    s.delete(listener);
    if (s.size === 0) listeners.delete(groupId);
  };
}

export function subscriberCount(groupId?: string): number {
  if (groupId) return listeners.get(groupId)?.size ?? 0;
  let n = 0;
  for (const s of listeners.values()) n += s.size;
  return n;
}

/**
 * Loads the message once and hands it to every subscriber of its group. Fire-and-forget:
 * never throws into the webhook pipeline.
 */
export function publishMessage(
  event: MessageStreamEvent,
  messageId: Types.ObjectId | string,
  customerGroupId: Types.ObjectId | string
): void {
  const set = listeners.get(String(customerGroupId));
  if (!set || set.size === 0) return;
  loadMessageItems({ _id: messageId })
    .lean()
    .then((rows) => {
      const item = rows[0];
      if (!item) return;
      for (const l of Array.from(listeners.get(String(customerGroupId)) ?? [])) {
        try {
          l(event, item);
        } catch (err) {
          console.warn('[MessageStream] listener failed:', err);
        }
      }
    })
    .catch((err) => console.warn('[MessageStream] load failed:', err));
}
