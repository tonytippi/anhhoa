import { afterEach, describe, expect, it, vi } from 'vitest';

const create = vi.fn();
vi.mock('@nestjs/core', () => ({ NestFactory: { create } }));

const { bootstrap, parsePort } = await import('./main.js');

const originalPort = process.env.PORT;

afterEach(() => {
  create.mockReset();
  if (originalPort === undefined) delete process.env.PORT;
  else process.env.PORT = originalPort;
});

describe('parsePort', () => {
  it('uses 3000 when PORT is absent and accepts valid integers', () => {
    expect(parsePort(undefined)).toBe(3000);
    expect(parsePort('1')).toBe(1);
    expect(parsePort('65535')).toBe(65535);
  });

  it.each(['', '0', '-1', '3000.5', 'abc', '65536'])('rejects invalid PORT %j', (value) => {
    expect(() => parsePort(value)).toThrow('PORT must be an integer between 1 and 65535.');
  });
});

describe('bootstrap', () => {
  it('listens on 3000 when PORT is absent without binding on import', async () => {
    delete process.env.PORT;
    const listen = vi.fn().mockResolvedValue(undefined);
    create.mockResolvedValue({ listen });

    expect(create).not.toHaveBeenCalled();
    await bootstrap();

    expect(listen).toHaveBeenCalledWith(3000);
  });

  it('listens on the valid explicit PORT', async () => {
    process.env.PORT = '4567';
    const listen = vi.fn().mockResolvedValue(undefined);
    create.mockResolvedValue({ listen });

    await bootstrap();

    expect(listen).toHaveBeenCalledWith(4567);
  });

  it('rejects an invalid PORT before creating or listening on the app', async () => {
    process.env.PORT = '3000.5';
    const listen = vi.fn().mockResolvedValue(undefined);
    create.mockResolvedValue({ listen });

    await expect(bootstrap()).rejects.toThrow('PORT must be an integer between 1 and 65535.');

    expect(create).not.toHaveBeenCalled();
    expect(listen).not.toHaveBeenCalled();
  });
});
