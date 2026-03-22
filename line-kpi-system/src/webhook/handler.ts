import { WebhookEvent } from '@line/bot-sdk';
import { handleMessageEvent } from './events/message';
import { handleJoinEvent } from './events/join';

/**
 * Dispatches LINE webhook events to the appropriate handler.
 * Group resolution happens per-event inside handleMessageEvent
 * (by looking up lineGroupId in GroupRegistry) — not at the OA level.
 */
export async function dispatchEvents(
  events: WebhookEvent[],
  oaId: string,
  oaAccessToken: string
): Promise<void> {
  for (const event of events) {
    try {
      if (event.type === 'message') {
        await handleMessageEvent(event, oaId, oaAccessToken);
      } else if (event.type === 'join') {
        await handleJoinEvent(event, oaAccessToken);
      }
    } catch (err) {
      console.error(`[Handler] Error processing event type=${event.type}:`, err);
      // Do not rethrow — a single event failure must not break other events
    }
  }
}
