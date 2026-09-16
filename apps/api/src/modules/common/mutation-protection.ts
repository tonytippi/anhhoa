import { UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';

type RequestLike = { headers: Record<string, string | undefined> };

const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(';').map((item) => item.trim().split('=')).find(([key]) => key === name)?.[1];

export function assertCookieMutation(request: RequestLike, origin: string, csrfCookieName: string, key?: string) {
  if (request.headers.origin !== origin || !request.headers['x-csrf-token'] || request.headers['x-csrf-token'] !== cookie(request, csrfCookieName)) {
    throw new UnauthorizedException({ code: 'CSRF_INVALID', message: 'CSRF không hợp lệ.' });
  }
  return key ?? '';
}

function canonicalJson(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalJson);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).sort(([left], [right]) => left.localeCompare(right)).map(([key, item]) => [key, canonicalJson(item)]));
  }
  return value;
}

export const requestFingerprint = (body: unknown) => createHash('sha256').update(JSON.stringify(canonicalJson(body))).digest('hex');
