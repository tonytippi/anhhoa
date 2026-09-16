type PrismaUniqueError = {
  code?: unknown;
  meta?: unknown;
};

const operationIdempotencyConstraints = new Set([
  'Operation_school_idempotency_scope_key',
  'Operation_platform_idempotency_scope_key',
]);

const operationIdempotencyColumns = new Set([
  'schoolId,actorType,actorReference,route,idempotencyKey',
  'platformOperatorGrantId,actorType,actorReference,route,idempotencyKey',
]);

function normalizeColumns(columns: string[]): string {
  return columns.map((column) => column.replace(/^.*\./, '').replace(/"/g, '')).join(',');
}

function isKnownTarget(target: unknown): boolean {
  if (typeof target === 'string') return operationIdempotencyConstraints.has(target.replace(/^.*\./, '').replace(/"/g, ''));
  return Array.isArray(target) && target.every((column) => typeof column === 'string') && operationIdempotencyColumns.has(normalizeColumns(target));
}

function hasKnownOperationConstraint(value: unknown): boolean {
  if (!value || typeof value !== 'object') return false;
  const record = value as Record<string, unknown>;
  if (isKnownTarget(record.target) || isKnownTarget(record.name) || isKnownTarget(record.fields)) return true;
  return Object.values(record).some(hasKnownOperationConstraint);
}

/** Prisma returns PostgreSQL unique targets as a direct target or nested adapter constraint. */
export function isOperationIdempotencyCollision(error: unknown): boolean {
  if (!error || typeof error !== 'object') return false;
  const { code, meta } = error as PrismaUniqueError;
  if (code !== 'P2002') return false;
  return hasKnownOperationConstraint(meta);
}
