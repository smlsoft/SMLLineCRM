export type AutoResolveMode = 'review' | 'auto';
export type AutoResolveLayer = 'rule' | 'ai';

export type TriageStatus = 'queued' | 'needs_reply' | 'resolved_pending_review' | null;

export interface MonitorConversation {
  _id: string;
  responseStatus: 'slow' | 'waiting' | 'normal';
  triageStatus?: TriageStatus;
  pendingMs: number;
  lastCustomerMessageAt: string | null;
  lastMessageAt: string;
  participantEmployeeIds: string[];
}

export interface MonitorGroup {
  _id: string;
  name: string;
  lineGroupId: string;
  isActive: boolean;
  priorityStatus: 'urgent' | 'warning' | 'normal';
  slowCount: number;
  waitingCount: number;
  openConvCount: number;
  oldestPendingMs: number | null;
  lastActivityAt: string | null;
  conversations: MonitorConversation[];
  triageStatus?: TriageStatus;
}

export interface RawGroupMessage {
  _id: string;
  conversationId: string;
  senderDisplayName: string;
  senderType: 'employee' | 'customer';
  messageType: string;
  textContent?: string;
  mediaId?: {
    _id?: string;
    data?: string;
    url?: string;
    mimeType?: string;
  };
  timestamp: string;
}

export interface CleanMessage {
  id: string;
  conversationId: string;
  senderType: 'employee' | 'customer';
  senderDisplayName: string;
  messageType: string;
  textContent?: string;
  hasImage: boolean;
  timestamp: string;
}

export interface SnapshotMessagePayload {
  senderType: 'employee' | 'customer';
  senderDisplayName: string;
  messageType: string;
  textContent?: string;
  timestamp: string;
}

export interface ProposeAutoResolvePayload {
  conversationId: string;
  layer: AutoResolveLayer;
  ruleCode?: string;
  reason: string;
  confidence?: number;
  lastMessageAtSnapshot: string;
  snapshotMessages: SnapshotMessagePayload[];
  proposedBy?: string;
}

export interface ProposeAutoResolveResponse {
  ok: boolean;
  skipped?: 'already_resolved' | 'employee_already_replied' | 'stale_snapshot' | 'duplicate';
  existingStatus?: string;
  logId?: string;
  mode?: AutoResolveMode;
  status?: string;
  log?: { _id: string; status: string };
}

// ---- Layer 2 triage queue (contract: SMLLineCRM .team/tasks/003-triage-queue.md) ----

export type TriageQueueStatus = 'pending' | 'claimed' | 'done' | 'failed' | 'expired';
export type TriageVerdict = 'resolved' | 'needs_reply';

export interface TriageQueueItem {
  _id: string;
  conversationId: string;
  customerGroupId: string;
  lineGroupId: string;
  lastMessageAtSnapshot: string;
  status: TriageQueueStatus;
  attempts: number;
  enqueueReason?: string;
  claimedBy?: string;
  leaseUntil?: string;
  verdict?: TriageVerdict;
}

export interface EnqueueTriagePayload {
  conversationId: string;
  lastMessageAtSnapshot: string;
  reason?: string;
  enqueuedBy?: string;
}

export interface EnqueueTriageResponse {
  ok: boolean;
  item?: TriageQueueItem;
  skipped?: 'duplicate' | 'employee_already_replied' | 'already_resolved' | 'stale_snapshot';
  existingStatus?: TriageQueueStatus;
  itemId?: string;
}

export interface ClaimedTriageMessage {
  _id: string;
  senderType: 'employee' | 'customer';
  senderDisplayName: string;
  messageType: string;
  textContent?: string;
  timestamp: string;
  employeeId?: { _id: string; name: string; employeeCode?: string } | null;
  mediaId?: { _id?: string; url?: string; mimeType?: string } | null;
}

export interface ClaimedTriage {
  item: TriageQueueItem;
  conversation: {
    _id: string;
    customerGroupId: string;
    lineGroupId: string;
    status: string;
    lastCustomerMessageAt?: string;
    lastEmployeeMessageAt?: string;
    lastMessageAt: string;
    /** Whole minutes from the customer's last message to the claim time, computed by the backend. */
    minutesSinceLastCustomerMessage: number | null;
  };
  messages: ClaimedTriageMessage[];
}

export interface CompleteTriagePayload {
  agentId: string;
  verdict: TriageVerdict;
  reason: string;
  confidence?: number;
  snapshotMessages?: SnapshotMessagePayload[];
}

export interface DailyJobsQuery {
  date?: string;
  groupId?: string;
  category?: string;
  employeeId?: string;
  page?: number;
  limit?: number;
}

export interface ConversationsQuery {
  date?: string;
  startDate?: string;
  endDate?: string;
  groupId?: string;
  status?: string;
}

export class SmllineCrmApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly path: string
  ) {
    super(message);
    this.name = 'SmllineCrmApiError';
  }
}

export interface SmllineCrmClientConfig {
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export function stripMessageMedia(raw: RawGroupMessage): CleanMessage {
  return {
    id: String(raw._id),
    conversationId: String(raw.conversationId),
    senderType: raw.senderType,
    senderDisplayName: raw.senderDisplayName,
    messageType: raw.messageType,
    ...(raw.textContent ? { textContent: raw.textContent } : {}),
    hasImage: raw.messageType === 'image' || Boolean(raw.mediaId),
    timestamp: raw.timestamp,
  };
}

export class SmllineCrmClient {
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(config: SmllineCrmClientConfig) {
    this.baseUrl = config.baseUrl.replace(/\/+$/, '');
    this.apiKey = config.apiKey;
    this.timeoutMs = config.timeoutMs ?? 15_000;
  }

  private async request<T>(path: string, init?: RequestInit): Promise<T> {
    const res = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      signal: AbortSignal.timeout(this.timeoutMs),
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.apiKey,
        ...(init?.headers ?? {}),
      },
    });

    if (!res.ok) {
      const bodyText = await res.text().catch(() => '');
      throw new SmllineCrmApiError(
        `SMLLineCRM API ${res.status} (${path}): ${bodyText || res.statusText}`,
        res.status,
        path
      );
    }

    if (res.status === 204) return null as T;
    return res.json() as Promise<T>;
  }

  async getMonitorGroups(): Promise<MonitorGroup[]> {
    return this.request<MonitorGroup[]>('/api/v1/monitor');
  }

  async getGroupMessages(groupId: string, limit = 15): Promise<CleanMessage[]> {
    const q = new URLSearchParams({ groupId, limit: String(limit) });
    const raw = await this.request<RawGroupMessage[]>(`/api/v1/messages?${q}`);
    return raw.map(stripMessageMedia);
  }

  async getAutoResolveMode(): Promise<{ mode: AutoResolveMode }> {
    return this.request<{ mode: AutoResolveMode }>('/api/v1/auto-resolve/mode');
  }

  async proposeAutoResolve(payload: ProposeAutoResolvePayload): Promise<ProposeAutoResolveResponse> {
    return this.request<ProposeAutoResolveResponse>('/api/v1/auto-resolve/propose', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  // ---- Layer 2 triage queue ----

  async enqueueTriage(payload: EnqueueTriagePayload): Promise<EnqueueTriageResponse> {
    return this.request<EnqueueTriageResponse>('/api/v1/auto-resolve/queue', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  /** Returns null when nothing is claimable (HTTP 204). */
  async claimTriage(agentId: string, leaseSeconds?: number): Promise<ClaimedTriage | null> {
    return this.request<ClaimedTriage | null>('/api/v1/auto-resolve/queue/claim', {
      method: 'POST',
      body: JSON.stringify({ agentId, ...(leaseSeconds ? { leaseSeconds } : {}) }),
    });
  }

  async completeTriage(itemId: string, payload: CompleteTriagePayload): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/api/v1/auto-resolve/queue/${encodeURIComponent(itemId)}/complete`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  async releaseTriage(itemId: string, agentId: string, error: string): Promise<Record<string, unknown>> {
    return this.request<Record<string, unknown>>(
      `/api/v1/auto-resolve/queue/${encodeURIComponent(itemId)}/release`,
      { method: 'POST', body: JSON.stringify({ agentId, error }) }
    );
  }

  // ---- Read-only reporting ----

  async getEmployeeActivityToday(): Promise<unknown[]> {
    return this.request<unknown[]>('/api/v1/monitor/employees');
  }

  async getDailyJobs(query: DailyJobsQuery = {}): Promise<unknown> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') q.set(k, String(v));
    return this.request<unknown>(`/api/v1/daily-report/jobs${q.size ? `?${q}` : ''}`);
  }

  async getEmployees(): Promise<unknown[]> {
    return this.request<unknown[]>('/api/v1/employees');
  }

  async getConversations(query: ConversationsQuery = {}): Promise<Record<string, unknown>[]> {
    const q = new URLSearchParams();
    for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== '') q.set(k, String(v));
    return this.request<Record<string, unknown>[]>(`/api/v1/conversations${q.size ? `?${q}` : ''}`);
  }
}
