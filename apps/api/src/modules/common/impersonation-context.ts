import { AsyncLocalStorage } from 'node:async_hooks';

// Carries the active Impersonation of the current request so every Operation and AuditRecord it writes records
// the Platform Operator who acted, without each service threading it through.
const storage = new AsyncLocalStorage<{ impersonationId: string }>();

export function runWithImpersonation<T>(impersonationId: string, callback: () => T): T {
  return storage.run({ impersonationId }, callback);
}

export function currentImpersonationId(): string | undefined {
  return storage.getStore()?.impersonationId;
}
