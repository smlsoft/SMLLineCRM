import { MessageEvent } from '@line/bot-sdk';
import { MessageProcessor } from '../../processors/MessageProcessor';
import { groupRegistry } from '../../services/GroupRegistry';

const processor = new MessageProcessor();

export async function handleMessageEvent(
  event: MessageEvent,
  oaId: string,
  oaAccessToken: string
): Promise<void> {
  const source = event.source;

  // Extract the LINE Group/Room/User ID that sent this event
  const lineGroupId =
    source.type === 'group'
      ? source.groupId
      : source.type === 'room'
      ? source.roomId
      : (source as { userId: string }).userId;

  const lineUserId = (source as { userId?: string }).userId;
  if (!lineUserId) {
    console.warn('[MessageEvent] No userId in source — skipping');
    return;
  }

  // Debug log — useful for identifying lineGroupId and lineUserId on first setup
  console.log(`[DEBUG] incoming | groupId=${lineGroupId} | userId=${lineUserId} | type=${event.message.type}`);

  // Route to customer group via GroupRegistry
  // 1 LINE OA joins many groups — group is identified by lineGroupId, not OA channel
  let group = groupRegistry.getByLineGroupId(lineGroupId);
  if (!group) {
    // OA is already in this group but no CustomerGroup record exists yet
    // (e.g. OA was added before the system was set up, so no join event fired)
    // Auto-register on first message — subsequent messages hit the cache at O(1)
    console.log(`[MessageEvent] Unknown group ${lineGroupId} — auto-registering from first message`);
    group = await groupRegistry.autoRegister(lineGroupId, oaAccessToken);
  }

  await processor.process({
    lineMessageId: event.message.id,
    lineGroupId,
    lineUserId,
    oaId,
    oaAccessToken,
    customerGroupId: group._id,
    messageType: event.message.type,
    textContent: event.message.type === 'text' ? event.message.text : undefined,
    timestamp: new Date(event.timestamp),
    rawEvent: event as unknown as Record<string, unknown>,
  });
}
