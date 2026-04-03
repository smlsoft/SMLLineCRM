export interface CustomerGroup {
  _id: string;
  name: string;
  description?: string;
  lineGroupId: string;
  assignedOaId?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface LineOa {
  _id: string;
  channelId: string;
  displayName: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface Employee {
  _id: string;
  lineUserId: string;
  name: string;
  employeeCode: string;
  department?: string;
  assignedGroupIds: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface IssueCategoryMaster {
  _id: string;
  name: string;
  description?: string;
  keywords?: string[];
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface TranscriptEntry {
  senderDisplayName: string;
  senderType: 'employee' | 'customer';
  messageType: string;
  textContent?: string;
  timestamp: string;
}

export interface Conversation {
  _id: string;
  lineGroupId: string;
  customerGroupId: { _id: string; name: string } | string;
  date: string;
  startedAt: string;
  lastMessageAt: string;
  status: 'open' | 'closed';
  responseStatus?: 'normal' | 'waiting' | 'slow';
  responseStatusOverride?: 'normal' | null;
  lastCustomerMessageAt?: string;
  lastEmployeeMessageAt?: string;
  messageCount: number;
  customerMessageCount: number;
  employeeMessageCount: number;
  avgResponseMs?: number;
  firstResponseMs?: number;
  participantEmployeeIds?: { _id: string; name: string; employeeCode: string }[];
  transcript?: TranscriptEntry[];
  issueCategory?: string;
  issueSummary?: string;
}

export interface GroupedConversationResult {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface Message {
  _id: string;
  conversationId: string;
  lineUserId: string;
  senderDisplayName: string;
  senderType: 'employee' | 'customer';
  employeeId?: { _id: string; name: string; employeeCode: string };
  messageType: string;
  textContent?: string;
  mediaId?: { _id: string; data?: string; url?: string; mimeType: string };
  timestamp: string;
}

export interface MonitorEmployee {
  _id: string;
  name: string;
  employeeCode: string;
}

export interface MonitorConversation {
  _id: string;
  responseStatus: 'slow' | 'waiting' | 'normal';
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
  assignedEmployees: MonitorEmployee[];
  conversations: MonitorConversation[];
}

export interface EmployeeStatus {
  _id: string;
  name: string;
  employeeCode: string;
  department?: string;
  lastResponseAt: string | null;
  lastResponseGroupId: string | null;
  lastResponseGroupName: string | null;
  idleMinutes: number | null;
  status: 'active' | 'idle' | 'away';
}

// ---- Daily Report ----

export interface EmployeeBreakdown {
  employeeId: string;
  employeeName: string;
  messageCount: number;
}

export interface IssueCategorySummary {
  category: string;
  count: number;
}

export interface DailyReport {
  _id: string;
  date: string;
  groupCount: number;
  jobCount: number;
  totalMessages: number;
  customerMessages: number;
  employeeMessages: number;
  employeeBreakdown: EmployeeBreakdown[];
  issueCategorySummary: IssueCategorySummary[];
  status: 'pending' | 'complete' | 'failed';
  totalGroups: number;
  processedGroups: number;
  aiProvider?: string;
  aiModel?: string;
  generatedAt?: string;
}

export interface DailyReportJobsResult {
  data: Conversation[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface DailyReportFilterOptions {
  groups: { _id: string; name: string }[];
  categories: string[];
  employees: { _id: string; name: string; employeeCode: string }[];
}

export interface DailyAnalysisRunState {
  date: string;
  status: 'idle' | 'running' | 'complete' | 'failed';
  totalGroups: number;
  processedGroups: number;
  startedAt?: string;
  completedAt?: string;
  error?: string;
}

// ---- AI Provider Groups ----

export interface AiProviderInGroup {
  providerKey: string;
  apiKey: string;
  baseUrl: string;
  models: string[];
  enabled: boolean;
}

export interface AiProviderGroup {
  name: string;
  providers: AiProviderInGroup[];
}

export type AiTaskName = 'issueAnalysis';

export interface AiModelOption {
  id: string;
  name: string;
  created?: number;
}

export interface ListModelsResponse {
  models: AiModelOption[];
  note?: string;
  error?: string;
}

// ---- Auth & Admin Users ----

export type PermissionKey =
  | 'dashboard'
  | 'monitor'
  | 'groups'
  | 'oas'
  | 'employees'
  | 'summaries'
  | 'issue-categories'
  | 'conversations'
  | 'settings'
  | 'users'
  | 'permission-groups';

export const ALL_PERMISSION_KEYS: PermissionKey[] = [
  'dashboard', 'monitor', 'groups', 'oas', 'employees',
  'summaries', 'issue-categories', 'conversations', 'settings',
  'users', 'permission-groups',
];

export const PERMISSION_LABELS: Record<PermissionKey, string> = {
  'dashboard': 'แดชบอร์ด',
  'monitor': 'จอ Monitor',
  'groups': 'กลุ่มลูกค้า',
  'oas': 'LINE OA',
  'employees': 'พนักงาน',
  'summaries': 'สรุปรายวัน',
  'issue-categories': 'ประเภทปัญหา',
  'conversations': 'บทสนทนา',
  'settings': 'ตั้งค่าระบบ',
  'users': 'ผู้ใช้งาน',
  'permission-groups': 'กลุ่มสิทธิ์',
};

export interface UserInfo {
  username: string;
  displayName: string;
  isSuperAdmin: boolean;
  permissions: PermissionKey[];
}

export interface PermissionGroup {
  _id: string;
  name: string;
  description?: string;
  permissions: PermissionKey[];
  createdAt: string;
  updatedAt: string;
}

export interface AdminUser {
  _id: string;
  username: string;
  displayName: string;
  groupId?: string | { _id: string; name: string; permissions: PermissionKey[] };
  additionalPermissions: PermissionKey[];
  isSuperAdmin: boolean;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface MediaR2Config {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface MediaS3Config {
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucketName: string;
  publicUrl: string;
}

export interface MediaStorageConfig {
  storage: 'none' | 'r2' | 's3';
  r2: MediaR2Config;
  s3: MediaS3Config;
}

export interface SystemConfig {
  jobs: {
    dailyAnalysis: { enabled: boolean };
  };
  ai: {
    providerGroups: Record<string, AiProviderGroup>;
    tasks: Record<AiTaskName, { groupId: string }>;
  };
  media: MediaStorageConfig;
  updatedAt: string;
}
