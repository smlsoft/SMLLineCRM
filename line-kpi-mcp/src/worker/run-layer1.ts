import 'dotenv/config';
import { pathToFileURL } from 'node:url';
import { SmllineCrmClient, type AutoResolveMode } from '../client.js';
import { evaluateLayer1, type Layer1RuleCode } from '../rules/layer1.js';
import { createPassTracker, singleFlight, startTriggerServer } from './trigger.js';

export interface RunLayer1Options {
  minIdleMinutes?: number;
  dryRun?: boolean;
  /** Check only `slow` (urgent, customer waiting > 15 min) conversations. Default true. */
  urgentOnly?: boolean;
  /** Send conversations no Layer 1 rule decided to the Layer 2 triage queue. Default true. */
  enqueueLayer2?: boolean;
  logger?: (line: string) => void;
}

export interface Layer1ItemSummary {
  groupId: string;
  groupName: string;
  conversationId: string;
  outcome: 'proposed' | 'dry_run_match' | 'skipped' | 'needs_layer2' | 'queued_layer2' | 'too_recent';
  ruleCode?: Layer1RuleCode;
  reason: string;
  apiSkipped?: string;
  mode?: AutoResolveMode;
}

export interface RunLayer1Summary {
  mode: AutoResolveMode;
  checkedGroups: number;
  checkedConversations: number;
  matchedCount: number;
  proposedCount: number;
  skippedCount: number;
  needsLayer2Count: number;
  enqueuedCount: number;
  items: Layer1ItemSummary[];
}

export async function runLayer1Pass(
  client: SmllineCrmClient,
  options: RunLayer1Options = {}
): Promise<RunLayer1Summary> {
  const minIdleMinutes = options.minIdleMinutes ?? 2;
  const dryRun = options.dryRun ?? false;
  const urgentOnly = options.urgentOnly ?? true;
  const enqueueLayer2 = options.enqueueLayer2 ?? true;
  const log = options.logger ?? console.log;

  const [groups, modeRes] = await Promise.all([
    client.getMonitorGroups(),
    client.getAutoResolveMode().catch(() => ({ mode: 'review' as const })),
  ]);

  const minIdleMs = minIdleMinutes * 60_000;
  const items: Layer1ItemSummary[] = [];
  let checkedGroups = 0;
  let checkedConversations = 0;
  let matchedCount = 0;
  let proposedCount = 0;
  let skippedCount = 0;
  let needsLayer2Count = 0;
  let enqueuedCount = 0;

  for (const group of groups) {
    const pendingConvs = group.conversations.filter(
      (c) => c.responseStatus === 'slow' || (!urgentOnly && c.responseStatus === 'waiting')
    );
    if (pendingConvs.length === 0) continue;

    const readyConvs = pendingConvs.filter((c) => c.pendingMs >= minIdleMs);
    if (readyConvs.length === 0) {
      for (const conv of pendingConvs) {
        items.push({
          groupId: group._id,
          groupName: group.name,
          conversationId: conv._id,
          outcome: 'too_recent',
          reason: `ลูกค้านิ่งยังไม่ครบ ${minIdleMinutes} นาที`,
        });
      }
      continue;
    }

    checkedGroups += 1;
    const messages = await client.getGroupMessages(group._id, 15);

    for (const conv of readyConvs) {
      checkedConversations += 1;
      const convMessages = messages.filter((m) => m.conversationId === conv._id);
      // Judge a room only on its own messages. If none are in the group's recent window,
      // evaluateLayer1 returns needsLayer2 and the room goes to the triage queue, where the
      // claim returns that conversation's own messages. Never fall back to the whole group:
      // another room's "ขอบคุณ" must not close this one.
      const evalResult = evaluateLayer1({
        messages: convMessages,
        pendingMs: conv.pendingMs,
        minIdleMinutes,
      });

      if (!evalResult.matched) {
        if (!evalResult.needsLayer2) {
          items.push({
            groupId: group._id,
            groupName: group.name,
            conversationId: conv._id,
            outcome: 'too_recent',
            reason: evalResult.reason,
          });
          continue;
        }

        needsLayer2Count += 1;
        const snapshot = conv.lastCustomerMessageAt ?? conv.lastMessageAt;
        if (dryRun || !enqueueLayer2) {
          items.push({
            groupId: group._id,
            groupName: group.name,
            conversationId: conv._id,
            outcome: 'needs_layer2',
            reason: evalResult.reason,
          });
          log(`[Layer1] PASS -> Layer2 (not queued${dryRun ? ', dry-run' : ''}) (${group.name}): ${evalResult.reason}`);
          continue;
        }

        const q = await client.enqueueTriage({
          conversationId: conv._id,
          lastMessageAtSnapshot: snapshot,
          reason: evalResult.reason,
          enqueuedBy: 'smllinecrm-mcp/layer1',
        });
        if (q.skipped) {
          items.push({
            groupId: group._id,
            groupName: group.name,
            conversationId: conv._id,
            outcome: 'needs_layer2',
            reason: evalResult.reason,
            apiSkipped: q.skipped,
          });
          log(`[Layer1] Layer2 queue SKIPPED (${q.skipped}) (${group.name})`);
        } else {
          enqueuedCount += 1;
          items.push({
            groupId: group._id,
            groupName: group.name,
            conversationId: conv._id,
            outcome: 'queued_layer2',
            reason: evalResult.reason,
          });
          log(`[Layer1] QUEUED -> Layer2 (${group.name}): ${evalResult.reason}`);
        }
        continue;
      }

      matchedCount += 1;
      const snapshotMessages = convMessages.slice(-10).map((m) => ({
        senderType: m.senderType,
        senderDisplayName: m.senderDisplayName,
        messageType: m.messageType,
        ...(m.textContent ? { textContent: m.textContent } : {}),
        timestamp: m.timestamp,
      }));

      if (dryRun) {
        items.push({
          groupId: group._id,
          groupName: group.name,
          conversationId: conv._id,
          outcome: 'dry_run_match',
          ruleCode: evalResult.ruleCode,
          reason: evalResult.reason,
        });
        log(`[Layer1] DRY-RUN MATCH [${evalResult.ruleCode}] (${group.name}): ${evalResult.reason}`);
        continue;
      }

      const res = await client.proposeAutoResolve({
        conversationId: conv._id,
        layer: 'rule',
        ruleCode: evalResult.ruleCode,
        reason: evalResult.reason,
        confidence: 1,
        lastMessageAtSnapshot: conv.lastCustomerMessageAt ?? conv.lastMessageAt,
        snapshotMessages,
        proposedBy: 'smllinecrm-mcp/layer1',
      });

      if (res.skipped) {
        skippedCount += 1;
        items.push({
          groupId: group._id,
          groupName: group.name,
          conversationId: conv._id,
          outcome: 'skipped',
          ruleCode: evalResult.ruleCode,
          reason: evalResult.reason,
          apiSkipped: res.skipped,
        });
        log(`[Layer1] SKIPPED (${res.skipped}) (${group.name})`);
      } else {
        proposedCount += 1;
        items.push({
          groupId: group._id,
          groupName: group.name,
          conversationId: conv._id,
          outcome: 'proposed',
          ruleCode: evalResult.ruleCode,
          reason: evalResult.reason,
          mode: res.mode,
        });
        log(`[Layer1] SUBMITTED [${res.status ?? res.mode}] (${group.name}): ${evalResult.reason}`);
      }
    }
  }

  return {
    mode: modeRes.mode,
    checkedGroups,
    checkedConversations,
    matchedCount,
    proposedCount,
    skippedCount,
    needsLayer2Count,
    enqueuedCount,
    items,
  };
}

async function runCli(): Promise<void> {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const loop = args.includes('--loop');

  const baseUrl = process.env.SMLLINECRM_API_URL;
  const apiKey = process.env.SMLLINECRM_API_KEY;
  if (!baseUrl || !apiKey) {
    console.error('[Layer1] Missing SMLLINECRM_API_URL or SMLLINECRM_API_KEY');
    process.exit(1);
  }

  const minIdleMinutes = Number(process.env.MIN_IDLE_MINUTES ?? '2') || 2;
  const pollIntervalSec = Number(process.env.POLL_INTERVAL_SEC ?? '1800') || 1800;
  const urgentOnly = (process.env.URGENT_ONLY ?? 'true').toLowerCase() !== 'false';
  const enqueueLayer2 = (process.env.ENQUEUE_LAYER2 ?? 'true').toLowerCase() !== 'false';
  const client = new SmllineCrmClient({ baseUrl, apiKey });

  // One pass at a time: the timer and on-demand triggers share a running pass.
  const runPass = singleFlight(async () => {
    const summary = await runLayer1Pass(client, { minIdleMinutes, dryRun, urgentOnly, enqueueLayer2 });
    console.log(
      `[Layer1] Done (mode=${summary.mode}, dryRun=${dryRun}): groups=${summary.checkedGroups}, matched=${summary.matchedCount}, proposed=${summary.proposedCount}, skipped=${summary.skippedCount}, needsLayer2=${summary.needsLayer2Count}, queuedLayer2=${summary.enqueuedCount}`
    );
    return summary;
  });

  const executeOnce = async () => {
    try {
      await runPass();
    } catch (err) {
      const cause = err instanceof Error && err.cause instanceof Error ? ` (${err.cause.message})` : '';
      console.error('[Layer1] Error:', (err instanceof Error ? err.message : String(err)) + cause);
      if (!loop) process.exitCode = 1;
    }
  };

  await executeOnce();

  if (loop) {
    console.log(`[Layer1] Loop mode enabled — polling every ${pollIntervalSec}s`);
    const timer = setInterval(executeOnce, pollIntervalSec * 1000);

    // On-demand pass for the backend ("check now"); reachable only inside the docker network.
    const triggerPort = Number(process.env.TRIGGER_PORT ?? '3005') || 3005;
    const tracker = createPassTracker(async () => {
      const { items: _items, ...counts } = await runPass();
      return counts;
    });
    const trigger = await startTriggerServer({ port: triggerPort, apiKey, tracker });
    console.log(`[Layer1] Trigger listening on :${triggerPort} (POST /run, GET /status)`);

    const stop = () => {
      clearInterval(timer);
      trigger.close();
      console.log('[Layer1] Stopping...');
      process.exit(0);
    };
    process.on('SIGINT', stop);
    process.on('SIGTERM', stop);
  }
}

if (process.argv[1] && pathToFileURL(process.argv[1]).href === import.meta.url) {
  runCli().catch((err) => {
    console.error('[Layer1] Fatal:', err instanceof Error ? err.message : String(err));
    process.exit(1);
  });
}
