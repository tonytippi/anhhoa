import { describe, expect, it } from 'vitest';

const databaseUrl = process.env.TARGET_INTEGRATION_DATABASE_URL;

describe.skipIf(!databaseUrl)('target database bootstrap', () => {
  it('requires a PostgreSQL target database supplied by the integration environment', () => {
    expect(databaseUrl).toMatch(/^postgresql:\/\//);
  });
});
