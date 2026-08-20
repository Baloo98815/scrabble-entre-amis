import 'dotenv/config';
import { buildApp } from './app.js';
import { env } from './config/env.js';
import { attachRealtime } from './realtime.js';
import { loadDictionaryCache } from './services/dictionary.service.js';

async function main(): Promise<void> {
  await loadDictionaryCache();
  const app = await buildApp();
  await app.ready();
  await attachRealtime(app);
  await app.listen({ port: env.PORT, host: '0.0.0.0' });
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
