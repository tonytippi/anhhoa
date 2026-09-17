import { createApi, parsePort } from './main.js';

const app = await createApi();
await app.listen(parsePort(), 'localhost');
