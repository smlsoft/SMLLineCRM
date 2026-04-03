import { Router, Request, Response } from 'express';
import axios from 'axios';
import { configService } from '../../services/ConfigService';
import { IAiProviderGroup, IAiProviderInGroup, AiTaskName, IMediaStorageConfig } from '../../models/SystemConfig';
import { aiRouter } from '../../services/ai';
import { KNOWN_PROVIDERS_MAP } from '../../services/ai/knownProviders';

const router = Router();

const MASK = '••••••';

function maskProviderInGroup(p: IAiProviderInGroup): IAiProviderInGroup {
  return { ...p, apiKey: p.apiKey ? MASK : '' };
}

function maskGroup(group: IAiProviderGroup): IAiProviderGroup {
  return { ...group, providers: group.providers.map(maskProviderInGroup) };
}

const EMPTY_MEDIA: IMediaStorageConfig = {
  storage: 'none',
  r2: { accountId: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' },
  s3: { region: '', accessKeyId: '', secretAccessKey: '', bucketName: '', publicUrl: '' },
};

function maskMediaConfig(media: IMediaStorageConfig | undefined): IMediaStorageConfig {
  if (!media) return EMPTY_MEDIA;
  return {
    storage: media.storage ?? 'none',
    r2: {
      accountId:   media.r2?.accountId   ?? '',
      accessKeyId: media.r2?.accessKeyId ?? '',
      secretAccessKey: media.r2?.secretAccessKey ? MASK : '',
      bucketName:  media.r2?.bucketName  ?? '',
      publicUrl:   media.r2?.publicUrl   ?? '',
    },
    s3: {
      region:      media.s3?.region      ?? '',
      accessKeyId: media.s3?.accessKeyId ?? '',
      secretAccessKey: media.s3?.secretAccessKey ? MASK : '',
      bucketName:  media.s3?.bucketName  ?? '',
      publicUrl:   media.s3?.publicUrl   ?? '',
    },
  };
}

function maskConfig(cfg: Awaited<ReturnType<typeof configService.getConfig>>) {
  const maskedGroups: Record<string, IAiProviderGroup> = {};
  for (const [key, group] of Object.entries(cfg.ai.providerGroups)) {
    maskedGroups[key] = maskGroup(group);
  }
  return {
    jobs: cfg.jobs,
    ai: {
      providerGroups: maskedGroups,
      tasks: cfg.ai.tasks,
    },
    media: maskMediaConfig(cfg.media),
    updatedAt: cfg.updatedAt,
  };
}

// GET /api/v1/config
router.get('/', async (_req: Request, res: Response) => {
  try {
    const cfg = await configService.getConfig();
    res.json(maskConfig(cfg));
  } catch (err) {
    console.error('[configRoutes] GET /config error:', err);
    res.status(500).json({ error: 'Failed to load config' });
  }
});

// PUT /api/v1/config
// Accepts partial updates: jobs, ai.providerGroups, ai.tasks
router.put('/', async (req: Request, res: Response) => {
  const body = req.body as {
    jobs?: {
      dailyAnalysis?: { enabled?: boolean };
    };
    ai?: {
      providerGroups?: Record<
        string,
        {
          name?: string;
          providers?: Array<{
            providerKey?: string;
            apiKey?: string;
            baseUrl?: string;
            models?: string[];
            enabled?: boolean;
          }>;
        } | null
      >;
      tasks?: Partial<Record<AiTaskName, { groupId?: string }>>;
    };
    media?: {
      storage?: 'none' | 'r2' | 's3';
      r2?: {
        accountId?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        bucketName?: string;
        publicUrl?: string;
      };
      s3?: {
        region?: string;
        accessKeyId?: string;
        secretAccessKey?: string;
        bucketName?: string;
        publicUrl?: string;
      };
    };
  };

  const patch: Record<string, unknown> = {};
  const unsetFields: Record<string, string> = {};

  // --- Jobs ---
  if (body.jobs?.dailyAnalysis?.enabled !== undefined) {
    patch['jobs.dailyAnalysis.enabled'] = body.jobs.dailyAnalysis.enabled;
  }

  // --- Provider Groups ---
  if (body.ai?.providerGroups) {
    for (const [groupId, groupData] of Object.entries(body.ai.providerGroups)) {
      if (groupData === null) {
        // Delete this group
        unsetFields[`ai.providerGroups.${groupId}`] = '';
        continue;
      }

      if (groupData.name !== undefined) {
        patch[`ai.providerGroups.${groupId}.name`] = groupData.name;
      }

      if (groupData.providers !== undefined) {
        // Store entire providers array (with masking guard on apiKey)
        const storedProviders = groupData.providers.map((p) => ({
          providerKey: p.providerKey ?? '',
          apiKey:      (p.apiKey && p.apiKey !== MASK) ? p.apiKey : undefined,
          baseUrl:     p.baseUrl ?? '',
          models:      p.models ?? [],
          enabled:     p.enabled ?? true,
        }));

        // We need to set the whole providers array — use $set on the array field
        // But we also need to preserve existing apiKeys for masked entries.
        // To do this correctly, we fetch current group and merge.
        patch[`ai.providerGroups.${groupId}.providers`] = storedProviders;
      }
    }
  }

  // --- Tasks ---
  if (body.ai?.tasks) {
    const tasks = body.ai.tasks;
    const taskNames: AiTaskName[] = ['issueAnalysis'];
    const tasksPatch: Partial<Record<AiTaskName, { groupId: string }>> = {};
    for (const task of taskNames) {
      const t = tasks[task];
      if (t?.groupId !== undefined) {
        tasksPatch[task] = { groupId: t.groupId };
      }
    }
    if (Object.keys(tasksPatch).length > 0) {
      // Set entire ai.tasks object to avoid Mongoose dot-notation issues
      // when ai sub-document contains both Map and nested object fields
      patch['ai.tasks'] = tasksPatch;
    }
  }

  // --- Media Storage ---
  if (body.media !== undefined) {
    if (body.media.storage !== undefined) {
      patch['media.storage'] = body.media.storage;
    }
    if (body.media.r2 !== undefined) {
      const cfg = await configService.getConfig();
      const existing = cfg.media.r2;
      patch['media.r2.accountId']       = body.media.r2.accountId       ?? existing.accountId;
      patch['media.r2.accessKeyId']     = body.media.r2.accessKeyId     ?? existing.accessKeyId;
      patch['media.r2.secretAccessKey'] = (body.media.r2.secretAccessKey && body.media.r2.secretAccessKey !== MASK)
        ? body.media.r2.secretAccessKey
        : existing.secretAccessKey;
      patch['media.r2.bucketName']      = body.media.r2.bucketName      ?? existing.bucketName;
      patch['media.r2.publicUrl']       = body.media.r2.publicUrl       ?? existing.publicUrl;
    }
    if (body.media.s3 !== undefined) {
      const cfg = await configService.getConfig();
      const existing = cfg.media.s3;
      patch['media.s3.region']          = body.media.s3.region          ?? existing.region;
      patch['media.s3.accessKeyId']     = body.media.s3.accessKeyId     ?? existing.accessKeyId;
      patch['media.s3.secretAccessKey'] = (body.media.s3.secretAccessKey && body.media.s3.secretAccessKey !== MASK)
        ? body.media.s3.secretAccessKey
        : existing.secretAccessKey;
      patch['media.s3.bucketName']      = body.media.s3.bucketName      ?? existing.bucketName;
      patch['media.s3.publicUrl']       = body.media.s3.publicUrl       ?? existing.publicUrl;
    }
  }

  // For providers array, we need to merge apiKeys from existing config when masked
  // Resolve stored providers before writing
  if (body.ai?.providerGroups) {
    const cfg = await configService.getConfig();

    for (const [groupId, groupData] of Object.entries(body.ai.providerGroups)) {
      if (!groupData || !groupData.providers) continue;
      const key = `ai.providerGroups.${groupId}.providers`;
      if (!patch[key]) continue;

      const existing = cfg.ai.providerGroups[groupId];

      const incomingProviders = groupData.providers;
      // Match existing provider by providerKey (not index) to preserve API keys correctly after reorder
      const existingByKey = new Map(
        (existing?.providers ?? []).map((p) => [p.providerKey, p])
      );
      const mergedProviders = incomingProviders.map((p) => {
        const existingProvider = p.providerKey ? existingByKey.get(p.providerKey) : undefined;
        const apiKey =
          p.apiKey && p.apiKey !== MASK
            ? p.apiKey
            : existingProvider?.apiKey ?? '';
        return {
          providerKey: p.providerKey ?? '',
          apiKey,
          baseUrl:     p.baseUrl ?? existingProvider?.baseUrl ?? '',
          models:      p.models ?? existingProvider?.models ?? [],
          enabled:     p.enabled ?? existingProvider?.enabled ?? true,
        };
      });
      patch[key] = mergedProviders;
    }
  }

  const updated = await configService.updateConfig(patch);

  // Handle unsets (group deletions)
  if (Object.keys(unsetFields).length > 0) {
    const { SystemConfig } = await import('../../models/SystemConfig');
    await SystemConfig.updateOne({ _id: 'singleton' }, { $unset: unsetFields });
    configService.clearCache();
  }

  const fresh = await configService.getConfig();
  res.json(maskConfig(fresh));
});

// POST /api/v1/config/test-ai
// Body: { task?: AiTaskName }
router.post('/test-ai', async (req: Request, res: Response) => {
  const task = (req.body?.task as AiTaskName) ?? 'issueAnalysis';

  try {
    const { providerName, modelName } = await aiRouter.getAdapterForTask(task);

    const cfg = await configService.getConfig();
    const groupId = cfg.ai.tasks?.[task]?.groupId ?? 'grp_default';
    const group = cfg.ai.providerGroups[groupId];
    const providerEntry = group?.providers.find((p) => p.providerKey === providerName);

    if (!providerEntry?.apiKey) {
      res.status(200).json({ success: false, error: `API key not configured for provider: ${providerName}` });
      return;
    }

    const { apiKey, baseUrl } = providerEntry;
    const knownDef = KNOWN_PROVIDERS_MAP[providerName];

    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    let url = `${baseUrl}/chat/completions`;

    if (!knownDef || knownDef.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (knownDef.authType === 'x-api-key') {
      headers['x-api-key'] = apiKey;
    } else if (knownDef.authType === 'query-param') {
      url += `?key=${encodeURIComponent(apiKey)}`;
    }
    if (knownDef?.extraHeaders) Object.assign(headers, knownDef.extraHeaders);

    const response = await axios.post(
      url,
      {
        model: modelName,
        messages: [{ role: 'user', content: 'Reply with exactly: {"ok":true}' }],
        temperature: 0,
        max_tokens: 20,
      },
      { headers, timeout: 15000 }
    );

    const content =
      response.data.choices?.[0]?.message?.content ??
      response.data.content?.[0]?.text ??
      '';
    res.json({ success: true, provider: providerName, model: modelName, task, response: content.slice(0, 100) });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err)
      ? `${err.response?.status ?? ''} ${JSON.stringify(err.response?.data ?? err.message)}`
      : String(err);
    res.status(200).json({ success: false, error: msg.slice(0, 300) });
  }
});

// POST /api/v1/config/test-media
// ทดสอบการเชื่อมต่อกับ R2 / S3 โดย list objects (1 item)
router.post('/test-media', async (_req: Request, res: Response) => {
  try {
    const cfg = await configService.getConfig();
    const { storage } = cfg.media;

    if (storage === 'none') {
      res.json({ success: false, error: 'Media storage is set to "none"' });
      return;
    }

    const { S3Client, ListObjectsV2Command } = await import('@aws-sdk/client-s3');

    let client: InstanceType<typeof S3Client>;
    let bucketName: string;

    if (storage === 'r2') {
      const { accountId, accessKeyId, secretAccessKey, bucketName: bn } = cfg.media.r2;
      if (!accountId || !accessKeyId || !secretAccessKey || !bn) {
        res.json({ success: false, error: 'R2 credentials incomplete' });
        return;
      }
      client = new S3Client({
        region: 'auto',
        endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
        credentials: { accessKeyId, secretAccessKey },
      });
      bucketName = bn;
    } else {
      const { region, accessKeyId, secretAccessKey, bucketName: bn } = cfg.media.s3;
      if (!region || !accessKeyId || !secretAccessKey || !bn) {
        res.json({ success: false, error: 'S3 credentials incomplete' });
        return;
      }
      client = new S3Client({ region, credentials: { accessKeyId, secretAccessKey } });
      bucketName = bn;
    }

    await client.send(new ListObjectsV2Command({ Bucket: bucketName, MaxKeys: 1 }));
    res.json({ success: true, storage });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.json({ success: false, error: msg.slice(0, 300) });
  }
});

// POST /api/v1/config/list-models
// Body: { provider: string, apiKey?: string }
router.post('/list-models', async (req: Request, res: Response) => {
  const { provider, apiKey: providedKey } = req.body as { provider: string; apiKey?: string };

  const knownDef = KNOWN_PROVIDERS_MAP[provider];
  if (!knownDef) {
    res.status(400).json({ models: [], error: `Unknown provider: ${provider}` });
    return;
  }

  if (knownDef.modelsPath === null) {
    res.json({ models: [], note: `${knownDef.displayName} ไม่มี model list endpoint` });
    return;
  }

  // Try to get a stored apiKey from any group that has this provider
  let storedApiKey = '';
  let storedBaseUrl = '';
  if (!providedKey || providedKey === MASK) {
    const cfg = await configService.getConfig();
    outer: for (const group of Object.values(cfg.ai.providerGroups)) {
      for (const p of group.providers) {
        if (p.providerKey === provider && p.apiKey) {
          storedApiKey = p.apiKey;
          storedBaseUrl = p.baseUrl || knownDef.defaultBaseUrl;
          break outer;
        }
      }
    }
  }

  const apiKey = (providedKey && providedKey !== MASK) ? providedKey : storedApiKey;
  const baseUrl = storedBaseUrl || knownDef.defaultBaseUrl;

  if (!apiKey && knownDef.modelsRequiresAuth) {
    res.status(400).json({ models: [], error: 'API key required but not provided' });
    return;
  }

  try {
    const models = await fetchProviderModels({ provider, apiKey, baseUrl, knownDef });
    res.json({ models });
  } catch (err: unknown) {
    const msg = axios.isAxiosError(err)
      ? `${err.response?.status ?? ''} ${JSON.stringify(err.response?.data ?? err.message)}`
      : String(err);
    res.status(200).json({ models: [], error: msg.slice(0, 300) });
  }
});

// ---- Helpers ----

interface ModelOption { id: string; name: string; created?: number }

async function fetchProviderModels(opts: {
  provider: string;
  apiKey: string;
  baseUrl: string;
  knownDef: (typeof KNOWN_PROVIDERS_MAP)[string];
}): Promise<ModelOption[]> {
  const { provider, apiKey, baseUrl, knownDef } = opts;

  const headers: Record<string, string> = {};
  let url = `${baseUrl}${knownDef.modelsPath}`;

  if (knownDef.modelsRequiresAuth) {
    if (knownDef.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${apiKey}`;
    } else if (knownDef.authType === 'x-api-key') {
      headers['x-api-key'] = apiKey;
    } else if (knownDef.authType === 'query-param') {
      url += `?key=${encodeURIComponent(apiKey)}`;
    }
    if (knownDef.extraHeaders) Object.assign(headers, knownDef.extraHeaders);
  }

  const response = await axios.get(url, { headers, timeout: 15000 });
  return normalizeModels(provider, response.data);
}

function normalizeModels(provider: string, data: unknown): ModelOption[] {
  if (!data || typeof data !== 'object') return [];
  const d = data as Record<string, unknown>;

  if (provider === 'gemini') {
    const list = (d['models'] as Array<Record<string, unknown>>) ?? [];
    return list.map((m) => ({
      id: String(m['name'] ?? '').replace(/^models\//, ''),
      name: String(m['displayName'] ?? m['name'] ?? ''),
    }));
  }

  if (provider === 'anthropic') {
    const list = (d['data'] as Array<Record<string, unknown>>) ?? [];
    return list.map((m) => ({
      id: String(m['id'] ?? ''),
      name: String(m['display_name'] ?? m['id'] ?? ''),
      created: m['created_at'] ? new Date(String(m['created_at'])).getTime() / 1000 : undefined,
    }));
  }

  if (provider === 'openrouter') {
    const list = (d['data'] as Array<Record<string, unknown>>) ?? [];
    return list.map((m) => ({
      id: String(m['id'] ?? ''),
      name: String(m['name'] ?? m['id'] ?? ''),
    }));
  }

  // OpenAI-compatible: { data: [{ id: '...', created: 1234 }] }
  const list = (d['data'] as Array<Record<string, unknown>>) ?? [];
  return list.map((m) => ({
    id: String(m['id'] ?? ''),
    name: String(m['id'] ?? ''),
    created: typeof m['created'] === 'number' ? m['created'] : undefined,
  }));
}

export { router as configRoutes };
