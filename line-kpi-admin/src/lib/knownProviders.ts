export type AiAuthType = 'bearer' | 'x-api-key' | 'query-param';

export interface KnownProviderDef {
  key: string;
  displayName: string;
  defaultBaseUrl: string;
  authType: AiAuthType;
  /** null = no model list endpoint */
  modelsPath: string | null;
  modelsRequiresAuth: boolean;
}

export const KNOWN_PROVIDERS: KnownProviderDef[] = [
  { key: 'openai',      displayName: 'OpenAI',          defaultBaseUrl: 'https://api.openai.com/v1',                        authType: 'bearer',      modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'anthropic',   displayName: 'Anthropic',        defaultBaseUrl: 'https://api.anthropic.com/v1',                     authType: 'x-api-key',   modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'gemini',      displayName: 'Google Gemini',    defaultBaseUrl: 'https://generativelanguage.googleapis.com/v1beta', authType: 'query-param', modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'deepseek',    displayName: 'DeepSeek',         defaultBaseUrl: 'https://api.deepseek.com',                         authType: 'bearer',      modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'mistral',     displayName: 'Mistral',          defaultBaseUrl: 'https://api.mistral.ai/v1',                        authType: 'bearer',      modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'groq',        displayName: 'Groq',             defaultBaseUrl: 'https://api.groq.com/openai/v1',                   authType: 'bearer',      modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'minimax',     displayName: 'MiniMax',          defaultBaseUrl: 'https://api.minimax.io/v1',                        authType: 'bearer',      modelsPath: null,      modelsRequiresAuth: false },
  { key: 'kimi',        displayName: 'Kimi (Moonshot)',  defaultBaseUrl: 'https://api.moonshot.ai/v1',                       authType: 'bearer',      modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'openrouter',  displayName: 'OpenRouter',       defaultBaseUrl: 'https://openrouter.ai/api/v1',                     authType: 'bearer',      modelsPath: '/models', modelsRequiresAuth: true  },
  { key: 'zai',         displayName: 'Z.ai (Zhipu)',     defaultBaseUrl: 'https://api.z.ai/api/paas/v4',                     authType: 'bearer',      modelsPath: null,      modelsRequiresAuth: false },
  { key: 'kilo',        displayName: 'Kilo AI',          defaultBaseUrl: 'https://api.kilo.ai/api/gateway',                  authType: 'bearer',      modelsPath: '/models', modelsRequiresAuth: false },
  { key: 'airouter',   displayName: 'SML Router',        defaultBaseUrl: 'https://airouter.satistang.com/v1',                authType: 'bearer',      modelsPath: null,      modelsRequiresAuth: false },
];

export const KNOWN_PROVIDERS_MAP: Record<string, KnownProviderDef> = Object.fromEntries(
  KNOWN_PROVIDERS.map((p) => [p.key, p])
);
