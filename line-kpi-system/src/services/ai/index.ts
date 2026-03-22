import { configService } from '../ConfigService';
import { AiAdapter } from './AiAdapter';
import { OpenRouterAdapter } from './OpenRouterAdapter';
import { KiloAdapter } from './KiloAdapter';

export async function createAiAdapter(): Promise<AiAdapter> {
  const cfg = await configService.getConfig();
  switch (cfg.ai.provider) {
    case 'kilo':
      return new KiloAdapter();
    case 'openrouter':
    default:
      return new OpenRouterAdapter();
  }
}

export type { AiAdapter };
