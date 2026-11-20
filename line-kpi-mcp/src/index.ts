import 'dotenv/config';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { SmllineCrmClient } from './client.js';
import { createSmllineCrmMcpServer } from './server.js';

async function main(): Promise<void> {
  const baseUrl = process.env.SMLLINECRM_API_URL;
  const apiKey = process.env.SMLLINECRM_API_KEY;

  if (!baseUrl || !apiKey) {
    console.error('[smllinecrm-mcp] Missing SMLLINECRM_API_URL or SMLLINECRM_API_KEY in environment');
    process.exit(1);
  }

  const client = new SmllineCrmClient({ baseUrl, apiKey });
  const readOnly = (process.env.MCP_READ_ONLY ?? 'false').toLowerCase() === 'true';
  const server = createSmllineCrmMcpServer(client, { readOnly });
  const transport = new StdioServerTransport();

  await server.connect(transport);
}

main().catch((err) => {
  console.error('[smllinecrm-mcp] Fatal error:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
