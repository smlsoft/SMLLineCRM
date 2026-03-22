import { Router, Request, Response } from 'express';
import axios from 'axios';
import { configService } from '../../services/ConfigService';

const router = Router();

const MASK = '••••••';

function maskConfig(cfg: Awaited<ReturnType<typeof configService.getConfig>>) {
  return {
    jobs: cfg.jobs,
    ai: {
      provider: cfg.ai.provider,
      openrouter: {
        apiKey: cfg.ai.openrouter.apiKey ? MASK : '',
        model: cfg.ai.openrouter.model,
        baseUrl: cfg.ai.openrouter.baseUrl,
      },
      kilo: {
        apiKey: cfg.ai.kilo.apiKey ? MASK : '',
        model: cfg.ai.kilo.model,
        baseUrl: cfg.ai.kilo.baseUrl,
      },
    },
    updatedAt: cfg.updatedAt,
  };
}

// GET /api/v1/config
router.get('/', async (_req: Request, res: Response) => {
  const cfg = await configService.getConfig();
  res.json(maskConfig(cfg));
});

// PUT /api/v1/config
router.put('/', async (req: Request, res: Response) => {
  const body = req.body as {
    jobs?: {
      dailyEvaluation?: { enabled?: boolean };
      issueAnalysis?: { enabled?: boolean };
    };
    ai?: {
      provider?: 'openrouter' | 'kilo';
      openrouter?: { apiKey?: string; model?: string; baseUrl?: string };
      kilo?: { apiKey?: string; model?: string; baseUrl?: string };
    };
  };

  // Build flat $set patch — skip masked apiKey values
  const patch: Record<string, unknown> = {};

  if (body.jobs?.dailyEvaluation?.enabled !== undefined) {
    patch['jobs.dailyEvaluation.enabled'] = body.jobs.dailyEvaluation.enabled;
  }
  if (body.jobs?.issueAnalysis?.enabled !== undefined) {
    patch['jobs.issueAnalysis.enabled'] = body.jobs.issueAnalysis.enabled;
  }
  if (body.ai?.provider) {
    patch['ai.provider'] = body.ai.provider;
  }
  if (body.ai?.openrouter) {
    const or = body.ai.openrouter;
    if (or.apiKey && or.apiKey !== MASK) patch['ai.openrouter.apiKey'] = or.apiKey;
    if (or.model !== undefined) patch['ai.openrouter.model'] = or.model;
    if (or.baseUrl !== undefined) patch['ai.openrouter.baseUrl'] = or.baseUrl;
  }
  if (body.ai?.kilo) {
    const k = body.ai.kilo;
    if (k.apiKey && k.apiKey !== MASK) patch['ai.kilo.apiKey'] = k.apiKey;
    if (k.model !== undefined) patch['ai.kilo.model'] = k.model;
    if (k.baseUrl !== undefined) patch['ai.kilo.baseUrl'] = k.baseUrl;
  }

  const updated = await configService.updateConfig(patch);
  res.json(maskConfig(updated));
});

// POST /api/v1/config/test-ai
router.post('/test-ai', async (_req: Request, res: Response) => {
  const cfg = await configService.getConfig();
  const provider = cfg.ai.provider;

  let apiKey: string;
  let model: string;
  let baseUrl: string;

  if (provider === 'kilo') {
    ({ apiKey, model, baseUrl } = cfg.ai.kilo);
  } else {
    ({ apiKey, model, baseUrl } = cfg.ai.openrouter);
  }

  if (!apiKey) {
    res.status(400).json({ success: false, error: 'API key not configured' });
    return;
  }

  try {
    const response = await axios.post(
      `${baseUrl}/chat/completions`,
      {
        model,
        messages: [{ role: 'user', content: 'Reply with exactly: {"ok":true}' }],
        temperature: 0,
        max_tokens: 20,
      },
      {
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
          ...(provider === 'openrouter' ? {
            'HTTP-Referer': 'https://line-kpi-system',
            'X-Title': 'LINE KPI System',
          } : {}),
        },
        timeout: 15000,
      }
    );

    const content = response.data.choices?.[0]?.message?.content ?? '';
    res.json({ success: true, provider, model, response: content.slice(0, 100) });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err)
      ? `${err.response?.status ?? ''} ${JSON.stringify(err.response?.data ?? err.message)}`
      : String(err);
    res.status(200).json({ success: false, provider, model, error: msg.slice(0, 300) });
  }
});

export { router as configRoutes };
