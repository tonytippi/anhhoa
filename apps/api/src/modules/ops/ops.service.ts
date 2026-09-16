import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { PrismaService } from '../identity/prisma.service.js';

type ProvisionInput = { name?: unknown; slug?: unknown; ownerEmail?: unknown };
const email = (value: unknown) => typeof value === 'string' ? value.trim().toLowerCase() : '';
const fingerprint = (body: unknown) => createHash('sha256').update(JSON.stringify(body)).digest('hex');
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class OpsService {
  constructor(private readonly prisma: PrismaService) {}

  async grantFor(identityId: string) {
    const grant = await this.prisma.platformOperatorGrant.findFirst({ where: { userIdentityId: identityId, revokedAt: null } });
    if (!grant) throw new ForbiddenException({ code: 'OPS_ACCESS_DENIED', message: 'Bạn không có quyền vận hành nền tảng.' });
    return grant;
  }

  async list(identityId: string) {
    await this.grantFor(identityId);
    const schools = await this.prisma.school.findMany({ orderBy: { createdAt: 'desc' }, include: { initialOwnerIdentity: true } });
    return schools.map((school) => {
      const owner = school.initialOwnerIdentity;
      return { id: school.id, name: school.name, slug: school.slug, status: school.status, ownerEmail: owner?.emailNormalized ?? '', ownerBound: Boolean(owner?.googleSubject), updatedAt: school.updatedAt.toISOString() };
    });
  }

  async provision(identityId: string, key: string, operationId: string, input: ProvisionInput) {
    if (!input || typeof input !== 'object' || Array.isArray(input)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Dữ liệu khởi tạo không hợp lệ.' });
    const grant = await this.grantFor(identityId); const name = typeof input.name === 'string' ? input.name.trim() : ''; const slug = typeof input.slug === 'string' ? input.slug.trim().toLowerCase() : ''; const ownerEmail = email(input.ownerEmail);
    if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(ownerEmail)) throw new ConflictException({ code: 'VALIDATION_ERROR', message: 'Dữ liệu khởi tạo không hợp lệ.' });
    return this.mutate(grant.id, identityId, 'POST /api/ops/schools', key, operationId, { name, slug, ownerEmail }, undefined, async (tx, operationId) => {
      const owner = await tx.userIdentity.upsert({ where: { emailNormalized: ownerEmail }, create: { emailNormalized: ownerEmail }, update: {} });
      if (owner.id === identityId) throw new ForbiddenException({ code: 'OPS_OWNER_BOOTSTRAP_DENIED', message: 'Platform Operator không thể là chủ sở hữu đầu tiên của trường.' });
      const school = await tx.school.create({ data: { name, slug, initialOwnerIdentityId: owner.id } });
      const membership = await tx.schoolMembership.create({ data: { schoolId: school.id, userIdentityId: owner.id } });
      await tx.schoolRoleGrant.create({ data: { schoolId: school.id, membershipId: membership.id, userIdentityId: owner.id, role: 'SCHOOL_ADMIN' } });
      await tx.auditRecord.create({ data: { schoolId: school.id, actorIdentityId: identityId, action: 'SCHOOL_PROVISIONED', provenance: { platformOperatorGrantId: grant.id, operationId } } });
      return { schoolId: school.id, status: school.status };
    });
  }

  async lifecycle(identityId: string, schoolId: string, next: 'ACTIVE' | 'SUSPENDED', key: string, operationId: string) {
    if (!uuid.test(schoolId)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Mã trường không hợp lệ.' });
    const grant = await this.grantFor(identityId);
    return this.mutate(grant.id, identityId, `POST /api/ops/schools/${schoolId}/${next.toLowerCase()}`, key, operationId, { schoolId, next }, schoolId, async (tx, operationId) => {
      const school = await tx.school.findUnique({ where: { id: schoolId } });
      if (!school) throw new NotFoundException({ code: 'SCHOOL_NOT_FOUND', message: 'Không tìm thấy trường.' });
      if (school.status !== next) {
        const updated = await tx.school.updateMany({ where: { id: school.id, status: school.status }, data: { status: next } });
        if (updated.count !== 1) throw new ConflictException({ code: 'SCHOOL_LIFECYCLE_CONFLICT', message: 'Trạng thái trường đã thay đổi. Hãy đối soát rồi thử lại.' });
        await tx.auditRecord.create({ data: { schoolId, actorIdentityId: identityId, action: next === 'SUSPENDED' ? 'SCHOOL_SUSPENDED' : 'SCHOOL_REACTIVATED', provenance: { platformOperatorGrantId: grant.id, operationId } } });
      }
      return { schoolId, status: next, noOp: school.status === next };
    });
  }

  async operation(identityId: string, operationId: string) {
    const grant = await this.grantFor(identityId); const operation = await this.prisma.operation.findFirst({ where: { id: operationId, platformOperatorGrantId: grant.id } });
    if (!operation) throw new NotFoundException({ code: 'OPERATION_NOT_FOUND', message: 'Không tìm thấy thao tác.' });
    return { id: operation.id, status: operation.status, outcome: operation.outcome };
  }

  private async mutate(grantId: string, identityId: string, route: string, key: string, operationId: string, body: unknown, schoolId: string | undefined, work: (tx: any, operationId: string) => Promise<unknown>) {
    if (!uuid.test(key) || !uuid.test(operationId)) throw new UnauthorizedException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Cần Idempotency-Key và X-Operation-Id UUID.' });
    const actorReference = grantId; const requestFingerprint = fingerprint(body);
    const existing = await this.prisma.operation.findUnique({ where: { actorReference_route_idempotencyKey: { actorReference, route, idempotencyKey: key } } });
    if (existing) { if (existing.fingerprint !== requestFingerprint) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key đã dùng cho yêu cầu khác.' }); return { id: existing.id, status: existing.status, outcome: existing.outcome }; }
    try {
      return await this.prisma.$transaction(async (tx) => {
        const operation = await tx.operation.create({ data: { id: operationId, schoolId, actorType: 'PLATFORM_OPERATOR_GRANT', actorReference, platformOperatorGrantId: grantId, actorIdentityId: identityId, route, idempotencyKey: key, fingerprint: requestFingerprint } });
        const outcome = await work(tx, operation.id);
        const completed = await tx.operation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', outcome: outcome as object } });
        return { id: completed.id, status: completed.status, outcome: completed.outcome };
      });
    } catch (error) {
      if ((error as { code?: string }).code !== 'P2002') throw error;
      const replay = await this.prisma.operation.findUnique({ where: { actorReference_route_idempotencyKey: { actorReference, route, idempotencyKey: key } } });
      if (replay?.fingerprint === requestFingerprint) return { id: replay.id, status: replay.status, outcome: replay.outcome };
      throw new ConflictException({ code: 'OPERATION_CONFLICT', message: 'Yêu cầu trùng với thao tác hoặc trường đã tồn tại.' });
    }
  }
}
