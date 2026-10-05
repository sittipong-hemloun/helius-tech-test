import { createApp } from './app.js';
import { loadEnv } from './env.js';

loadEnv();
const app = await createApp();
await app.listen(Number(process.env.PORT ?? 3001), '127.0.0.1');
