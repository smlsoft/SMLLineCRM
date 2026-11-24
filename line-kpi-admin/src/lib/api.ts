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

// ---- Auth ----
export const authApi = {
  login: (body: { username: string; password: string }) =>
    apiFetch<{ user: import('@/types/api').UserInfo }>(`${P}/auth/login`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  logout: () =>
    apiFetch<{ ok: boolean }>(`${P}/auth/logout`, { method: 'POST' }),
  me: () =>
    apiFetch<import('@/types/api').UserInfo>(`${P}/auth/me`),
};

// ---- Admin Users ----
export const adminUsersApi = {
  list: () => apiFetch<import('@/types/api').AdminUser[]>(`${P}/admin/users`),
  create: (body: {
    username: string;
    password: string;
    displayName: string;
    groupId?: string;
    additionalPermissions?: import('@/types/api').PermissionKey[];
  }) => apiFetch<import('@/types/api').AdminUser>(`${P}/admin/users`, { method: 'POST', body: JSON.stringify(body) }),
  get: (id: string) => apiFetch<import('@/types/api').AdminUser>(`${P}/admin/users/${id}`),
  update: (id: string, body: Partial<{
    displayName: string;
    groupId: string | null;
    additionalPermissions: import('@/types/api').PermissionKey[];
    isActive: boolean;
  }>) => apiFetch<import('@/types/api').AdminUser>(`${P}/admin/users/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  changePassword: (id: string, newPassword: string) =>
    apiFetch<{ ok: boolean }>(`${P}/admin/users/${id}/password`, {
      method: 'POST',
      body: JSON.stringify({ newPassword }),
    }),
  delete: (id: string) =>
    apiFetch<{ ok: boolean }>(`${P}/admin/users/${id}`, { method: 'DELETE' }),
};

// ---- Admin Permission Groups ----
export const permissionGroupsApi = {
  list: () => apiFetch<import('@/types/api').PermissionGroup[]>(`${P}/admin/permission-groups`),
  create: (body: { name: string; description?: string; permissions: import('@/types/api').PermissionKey[] }) =>
    apiFetch<import('@/types/api').PermissionGroup>(`${P}/admin/permission-groups`, { method: 'POST', body: JSON.stringify(body) }),
  update: (id: string, body: Partial<{ name: string; description: string; permissions: import('@/types/api').PermissionKey[] }>) =>
    apiFetch<import('@/types/api').PermissionGroup>(`${P}/admin/permission-groups/${id}`, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (id: string) =>
    apiFetch<{ ok: boolean }>(`${P}/admin/permission-groups/${id}`, { method: 'DELETE' }),
};

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
  setAssistantLogin: (id: string, body: { username?: string; password?: string; enabled?: boolean }) =>
    apiFetch<import('@/types/api').Employee>(`${P}/employees/${id}/assistant-login`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  /** Saved assistant password; needs a signed-in manager. Each call is logged by the backend. */
  getAssistantPassword: (id: string) =>
    apiFetch<{ password: string }>(`${P}/employees/${id}/assistant-login/password`),
  removeAssistantLogin: (id: string) =>
    apiFetch<import('@/types/api').Employee>(`${P}/employees/${id}/assistant-login`, { method: 'DELETE' }),
};

// ---- Issue Category Master ----
export const issueCategoriesApi = {
  list: () =>
    apiFetch<import('@/types/api').IssueCategoryMaster[]>(`${P}/issue-categories`),
  create: (body: { name: string; description?: string; keywords?: string[] }) =>
    apiFetch<import('@/types/api').IssueCategoryMaster>(`${P}/issue-categories`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
  update: (id: string, body: Partial<{ name: string; description: string; keywords: string[]; isActive: boolean }>) =>
    apiFetch<import('@/types/api').IssueCategoryMaster>(`${P}/issue-categories/${id}`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  deactivate: (id: string) =>
    apiFetch(`${P}/issue-categories/${id}`, { method: 'DELETE' }),
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
  /** Oldest first. `limit` keeps only the newest N; `noMedia` drops image payloads (light previews). */
  list: (conversationId: string, opts?: { limit?: number; noMedia?: boolean }) => {
    const q = new URLSearchParams();
    if (opts?.limit) q.set('limit', String(opts.limit));
    if (opts?.noMedia) q.set('noMedia', '1');
    const qs = q.toString();
    return apiFetch<import('@/types/api').Message[]>(
      `${P}/conversations/${conversationId}/messages${qs ? `?${qs}` : ''}`
    );
  },
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
  getEmployees: () =>
    apiFetch<import('@/types/api').EmployeeStatus[]>(`${P}/monitor/employees`),
};

// ---- Daily Report ----
export const dailyReportApi = {
  getSummary: (date: string) =>
    apiFetch<import('@/types/api').DailyReport | null>(`${P}/daily-report?date=${date}`),
  getJobs: (params: {
    date: string;
    groupId?: string;
    category?: string;
    employeeId?: string;
    sort?: string;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    q.set('date', params.date);
    if (params.groupId) q.set('groupId', params.groupId);
    if (params.category) q.set('category', params.category);
    if (params.employeeId) q.set('employeeId', params.employeeId);
    if (params.sort) q.set('sort', params.sort);
    if (params.page) q.set('page', String(params.page));
    if (params.limit) q.set('limit', String(params.limit));
    return apiFetch<import('@/types/api').DailyReportJobsResult>(`${P}/daily-report/jobs?${q}`);
  },
  getFilterOptions: (date: string) =>
    apiFetch<import('@/types/api').DailyReportFilterOptions>(`${P}/daily-report/filter-options?date=${date}`),
  getJobStatus: () =>
    apiFetch<import('@/types/api').DailyAnalysisRunState>(`${P}/daily-report/job-status`),
  trigger: (body: { date?: string; force?: boolean }) =>
    apiFetch<{ ok: boolean; message: string }>(`${P}/daily-report/trigger`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),
};

// ---- System Config ----
export const configApi = {
  get: () => apiFetch<import('@/types/api').SystemConfig>(`${P}/config`),
  update: (body: object) =>
    apiFetch<import('@/types/api').SystemConfig>(`${P}/config`, {
      method: 'PUT',
      body: JSON.stringify(body),
    }),
  testAi: (task?: import('@/types/api').AiTaskName) =>
    apiFetch<{ success: boolean; provider?: string; model?: string; task?: string; response?: string; error?: string }>(
      `${P}/config/test-ai`,
      { method: 'POST', body: JSON.stringify({ task }) }
    ),
  listModels: (provider: string, apiKey?: string) =>
    apiFetch<import('@/types/api').ListModelsResponse>(`${P}/config/list-models`, {
      method: 'POST',
      body: JSON.stringify({ provider, apiKey }),
    }),
  testMedia: () =>
    apiFetch<{ success: boolean; storage?: string; error?: string }>(`${P}/config/test-media`, {
      method: 'POST',
    }),
  cleanupMedia: () =>
    apiFetch<{
      success: boolean;
      deletedCount?: number;
      failedObjectDeletes?: number;
      retentionDays?: number;
      skipped?: string;
      error?: string;
    }>(`${P}/config/cleanup-media`, {
      method: 'POST',
    }),
};

// ---- Auto-Resolve Review & Log ----
// ---- Layer 1 "check now" (refresh button on /monitor and /auto-resolve) ----
export const layer1Api = {
  /** Starts a background pass (or joins the running one); returns at once. */
  checkNow: () =>
    apiFetch<{ ok: boolean; started: boolean; status: import('@/types/api').Layer1CheckStatus }>(
      `${P}/admin/layer1/check-now`,
      { method: 'POST' }
    ),
  status: () => apiFetch<import('@/types/api').Layer1CheckStatus>(`${P}/admin/layer1/status`),
};

/** One-line Thai summary of a Layer 1 pass for the refresh banner. */
export function formatLayer1Summary(s: import('@/types/api').Layer1CheckSummary): string {
  return `ตรวจแล้ว ${s.checkedGroups} กลุ่ม · เสนอปิด ${s.proposedCount} · ส่งให้ AI ${s.enqueuedCount}`;
}

export const autoResolveApi = {
  listLogs: (params?: {
    status?: import('@/types/api').AutoResolveStatus | 'all';
    layer?: import('@/types/api').AutoResolveLayer;
    page?: number;
    limit?: number;
  }) => {
    const q = new URLSearchParams();
    if (params?.status) q.set('status', params.status);
    if (params?.layer) q.set('layer', params.layer);
    if (params?.page) q.set('page', String(params.page));
    if (params?.limit) q.set('limit', String(params.limit));
    return apiFetch<import('@/types/api').AutoResolveLogsResponse>(`${P}/admin/auto-resolve/logs?${q}`);
  },
  approve: (id: string) =>
    apiFetch<{ ok: boolean; log: import('@/types/api').AutoResolveLog }>(`${P}/admin/auto-resolve/logs/${id}/approve`, {
      method: 'POST',
    }),
  reject: (id: string, note?: string) =>
    apiFetch<{ ok: boolean; log: import('@/types/api').AutoResolveLog }>(`${P}/admin/auto-resolve/logs/${id}/reject`, {
      method: 'POST',
      body: JSON.stringify({ note }),
    }),
  revert: (id: string) =>
    apiFetch<{ ok: boolean; log: import('@/types/api').AutoResolveLog }>(`${P}/admin/auto-resolve/logs/${id}/revert`, {
      method: 'POST',
    }),
  listQueue: () =>
    apiFetch<import('@/types/api').TriageQueueResponse>(`${P}/admin/auto-resolve/queue`),
  setMode: (mode: import('@/types/api').AutoResolveMode) =>
    apiFetch<{ ok: boolean; mode: import('@/types/api').AutoResolveMode }>(`${P}/admin/auto-resolve/mode`, {
      method: 'PATCH',
      body: JSON.stringify({ mode }),
    }),
};
