// All API calls go through the Next.js proxy at /api/proxy/*
// This keeps the backend API key server-side only

async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(path, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error((err as { error?: string }).error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

const P = '/api/proxy';

// ---- Customer Groups ----
export const groupsApi = {
  list: () => apiFetch<import('@/types/api').CustomerGroup[]>(`${P}/oas/groups/list`),
  create: (body: { name: string; lineGroupId: string; description?: string }) =>
    apiFetch(`${P}/oas/groups`, { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ name: string; lineGroupId: string; description: string; isActive: boolean }>) =>
    apiFetch(`${P}/oas/groups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

// ---- LINE OAs ----
export const oasApi = {
  list: () => apiFetch<import('@/types/api').LineOa[]>(`${P}/oas`),
  create: (body: { channelId: string; channelSecret: string; channelAccessToken: string; displayName: string }) =>
    apiFetch(`${P}/oas`, { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ channelSecret: string; channelAccessToken: string; displayName: string; isActive: boolean }>) =>
    apiFetch(`${P}/oas/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
};

// ---- Employees ----
export const employeesApi = {
  list: () => apiFetch<import('@/types/api').Employee[]>(`${P}/employees`),
  create: (body: { lineUserId: string; name: string; employeeCode: string; department?: string }) =>
    apiFetch(`${P}/employees`, { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<import('@/types/api').Employee>) =>
    apiFetch(`${P}/employees/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  deactivate: (id: string) =>
    apiFetch(`${P}/employees/${id}`, { method: 'DELETE' }),
};

// ---- KPI Records ----
export const kpiApi = {
  list: (params: { date?: string; groupId?: string; employeeId?: string; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return apiFetch<import('@/types/api').KpiRecord[]>(`${P}/kpi?${q}`);
  },
};

// ---- Daily Summaries ----
export const summariesApi = {
  list: (params: { date?: string; groupId?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return apiFetch<import('@/types/api').DailySummary[]>(`${P}/summaries?${q}`);
  },
  trigger: (body: { date: string }) =>
    apiFetch(`${P}/summaries/trigger`, { method: 'POST', body: JSON.stringify(body) }),
};

// ---- Issue Reports ----
export const issueReportsApi = {
  list: (params: { date?: string; groupId?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return apiFetch<import('@/types/api').IssueReport[]>(`${P}/issue-reports?${q}`);
  },
  trend: (params: { groupId?: string; category?: string; weeks?: number }) => {
    const q = new URLSearchParams();
    if (params.groupId) q.set('groupId', params.groupId);
    if (params.category) q.set('category', params.category);
    if (params.weeks) q.set('weeks', String(params.weeks));
    return apiFetch<import('@/types/api').IssueReport[]>(`${P}/issue-reports/trend?${q}`);
  },
  trigger: (body: { date: string }) =>
    apiFetch(`${P}/issue-reports/trigger`, { method: 'POST', body: JSON.stringify(body) }),
};

// ---- KPI Leaderboard + Trend ----
export const kpiLeaderboardApi = {
  leaderboard: (params: { groupId?: string; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return apiFetch<import('@/types/api').LeaderboardEntry[]>(`${P}/kpi/leaderboard?${q}`);
  },
  trend: (params: { employeeId?: string; groupId?: string; weeks?: number }) => {
    const q = new URLSearchParams();
    if (params.employeeId) q.set('employeeId', params.employeeId);
    if (params.groupId) q.set('groupId', params.groupId);
    if (params.weeks) q.set('weeks', String(params.weeks));
    return apiFetch<import('@/types/api').KpiTrendPoint[]>(`${P}/kpi/trend?${q}`);
  },
};

// ---- Conversations ----
export const conversationsApi = {
  list: (params: { date?: string; groupId?: string; status?: string; startDate?: string; endDate?: string }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v) as [string, string][]);
    return apiFetch<import('@/types/api').Conversation[]>(`${P}/conversations?${q}`);
  },
  grouped: (params: { responseStatus?: string; page?: number; limit?: number }) => {
    const q = new URLSearchParams(Object.entries(params).filter(([, v]) => v !== undefined) as [string, string][]);
    return apiFetch<import('@/types/api').GroupedConversationResult>(`${P}/conversations/grouped?${q}`);
  },
  get: (id: string) =>
    apiFetch<import('@/types/api').Conversation>(`${P}/conversations/${id}`),
  setResponseStatus: (id: string, responseStatusOverride: 'normal' | null) =>
    apiFetch(`${P}/conversations/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ responseStatusOverride }),
    }),
};

// ---- Messages ----
export const messagesApi = {
  list: (conversationId: string) =>
    apiFetch<import('@/types/api').Message[]>(`${P}/conversations/${conversationId}/messages`),
  listByGroup: (params: { groupId: string; before?: string; limit?: number }) => {
    const q = new URLSearchParams();
    q.set('groupId', params.groupId);
    if (params.before) q.set('before', params.before);
    if (params.limit) q.set('limit', String(params.limit));

    return apiFetch<import('@/types/api').Message[]>(`${P}/messages?${q}`);
  },
};

// ---- Monitor ----
export const monitorApi = {
  get: () => apiFetch<import('@/types/api').MonitorGroup[]>(`${P}/monitor`),
  resolve: (conversationId: string, resolutionStatus: 'resolved' | 'unresolved' | 'pending') =>
    apiFetch<{ _id: string; resolutionStatus: string; resolvedAt: string | null }>(
      `${P}/monitor/${conversationId}/resolve`,
      { method: 'PATCH', body: JSON.stringify({ resolutionStatus }) }
    ),
};

// ---- System Config ----
export const configApi = {
  get: () => apiFetch<import('@/types/api').SystemConfig>(`${P}/config`),
  update: (body: object) =>
    apiFetch<import('@/types/api').SystemConfig>(`${P}/config`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  testAi: () =>
    apiFetch<{ success: boolean; provider?: string; model?: string; response?: string; error?: string }>(
      `${P}/config/test-ai`,
      { method: 'POST', body: '{}' }
    ),
};
