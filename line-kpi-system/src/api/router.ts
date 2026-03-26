import { Router } from 'express';
import { apiKeyAuth } from './middleware/auth';
import { jwtAuth } from './middleware/jwtAuth';
import { authRoutes } from './routes/authRoutes';
import { adminUserRoutes } from './routes/adminUserRoutes';
import { permissionGroupRoutes } from './routes/permissionGroupRoutes';
import { employeeRoutes } from './routes/employeeRoutes';
import { oaRoutes } from './routes/oaRoutes';
import { conversationRoutes } from './routes/conversationRoutes';
import { messageRoutes } from './routes/messageRoutes';
import { groupMessageRoutes } from './routes/groupMessageRoutes';
import { monitorRoutes } from './routes/monitorRoutes';
import { configRoutes } from './routes/configRoutes';
import { issueCategoryRoutes } from './routes/issueCategoryRoutes';
import { dailyReportRoutes } from './routes/dailyReportRoutes';

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
apiRouter.use('/config', configRoutes);
apiRouter.use('/issue-categories', issueCategoryRoutes);

// ── Admin management routes (API key + JWT required) ──────────
apiRouter.use('/admin/users', jwtAuth, adminUserRoutes);
apiRouter.use('/admin/permission-groups', jwtAuth, permissionGroupRoutes);

export { apiRouter };
