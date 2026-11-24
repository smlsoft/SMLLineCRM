import { Router } from 'express';
import { apiKeyAuth } from './middleware/auth';
import { jwtAuth, requirePermission } from './middleware/jwtAuth';
import { authRoutes } from './routes/authRoutes';
import { adminUserRoutes } from './routes/adminUserRoutes';
import { permissionGroupRoutes } from './routes/permissionGroupRoutes';
import { employeeRoutes } from './routes/employeeRoutes';
import { assistantStreamRoutes } from './routes/assistantStreamRoutes';
import { assistantAuthRoutes } from './routes/assistantAuthRoutes';
import { oaRoutes } from './routes/oaRoutes';
import { conversationRoutes } from './routes/conversationRoutes';
import { messageRoutes } from './routes/messageRoutes';
import { groupMessageRoutes } from './routes/groupMessageRoutes';
import { monitorRoutes } from './routes/monitorRoutes';
import { configRoutes } from './routes/configRoutes';
import { mediaRoutes } from './routes/mediaRoutes';
import { issueCategoryRoutes } from './routes/issueCategoryRoutes';
import { dailyReportRoutes } from './routes/dailyReportRoutes';
import { autoResolveAgentRoutes, autoResolveAdminRoutes } from './routes/autoResolveRoutes';
import { layer1Routes } from './routes/layer1Routes';

const apiRouter = Router();

// ── Public auth routes (no API key required) ─────────────────
apiRouter.use('/auth', authRoutes);

// ── All management API routes require API key auth ────────────
apiRouter.use(apiKeyAuth);

apiRouter.use('/employees', employeeRoutes);
apiRouter.use('/oas', oaRoutes);
apiRouter.use('/daily-report', dailyReportRoutes);
apiRouter.use('/conversations', conversationRoutes);
apiRouter.use('/conversations/:conversationId/messages', messageRoutes);
apiRouter.use('/messages', groupMessageRoutes);
apiRouter.use('/monitor', monitorRoutes);
apiRouter.use('/config', jwtAuth, requirePermission('settings'), configRoutes);
apiRouter.use('/media', jwtAuth, mediaRoutes);
apiRouter.use('/issue-categories', issueCategoryRoutes);
apiRouter.use('/auto-resolve', autoResolveAgentRoutes);
// Staff AI assistant app: checks an employee's Basic-auth login (API key still required).
apiRouter.use('/assistant/auth', assistantAuthRoutes);
apiRouter.use('/assistant/groups', assistantStreamRoutes);

// ── Admin management routes (API key + JWT required) ──────────
apiRouter.use('/admin/users', jwtAuth, adminUserRoutes);
apiRouter.use('/admin/permission-groups', jwtAuth, permissionGroupRoutes);
apiRouter.use('/admin/auto-resolve', jwtAuth, autoResolveAdminRoutes);
apiRouter.use('/admin/layer1', jwtAuth, layer1Routes);

export { apiRouter };
