import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { PrismaService } from '../identity/prisma.service.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { auditData } from '../common/audit.js';
import { requestFingerprint } from '../common/mutation-protection.js';
import { isOperationIdempotencyCollision } from '../common/operation-idempotency.js';

type Role = 'SCHOOL_ADMIN' | 'FINANCE_MANAGER' | 'CLASS_TEACHER';
const roles = new Set<Role>(['SCHOOL_ADMIN', 'FINANCE_MANAGER', 'CLASS_TEACHER']);
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

@Injectable()
export class MembershipsService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}
  private roleSet(value: unknown): Role[] {
    if (!Array.isArray(value) || !value.length || value.some((role) => typeof role !== 'string' || !roles.has(role as Role))) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Preset quyền không hợp lệ.' });
    return [...new Set(value as Role[])];
  }
  private async actor(identityId: string, schoolId: string) { return this.authorization.resolve(identityId, schoolId, 'app', 'ACCESS_MANAGE'); }
  async list(identityId: string, schoolId: string) {
    await this.actor(identityId, schoolId);
    const memberships = await this.prisma.schoolMembership.findMany({ where: { schoolId }, include: { userIdentity: true, roleGrants: true }, orderBy: { createdAt: 'asc' } });
    return memberships.map((membership) => ({ id: membership.id, email: membership.userIdentity.emailNormalized, status: membership.status, roles: membership.roleGrants.map((grant) => grant.role) }));
  }
  async create(identityId: string, schoolId: string, key: string, operationId: string, body: { email?: unknown; roles?: unknown; reason?: unknown }) {
    const actor = await this.actor(identityId, schoolId); const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''; const selectedRoles = this.roleSet(body.roles);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Email không hợp lệ.' });
    return this.mutate(actor, identityId, schoolId, 'POST /api/app/schools/:schoolId/memberships', key, operationId, { email, roles: selectedRoles, reason: body.reason }, async (tx, op) => {
      const user = await tx.userIdentity.upsert({ where: { emailNormalized: email }, create: { emailNormalized: email }, update: {} });
      const membership = await tx.schoolMembership.create({ data: { schoolId, userIdentityId: user.id } });
      await tx.schoolRoleGrant.createMany({ data: selectedRoles.map((role) => ({ schoolId, membershipId: membership.id, role })) });
       await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: 'SCHOOL_MEMBERSHIP', reference: actor.membershipId, membershipId: actor.membershipId }, 'MEMBERSHIP_CREATED', { operationId: op, targetMembershipId: membership.id }, typeof body.reason === 'string' ? body.reason : null) });
      return { membershipId: membership.id, status: 'ACTIVE', roles: selectedRoles };
    });
  }
  async revoke(identityId: string, schoolId: string, membershipId: string, key: string, operationId: string, body: { reason?: unknown }) {
    const actor = await this.actor(identityId, schoolId); const reason = typeof body.reason === 'string' ? body.reason.trim() : '';
    if (!reason) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Cần nêu lý do thu hồi.' });
    return this.mutate(actor, identityId, schoolId, 'POST /api/app/schools/:schoolId/memberships/:membershipId/revoke', key, operationId, { membershipId, reason }, async (tx, op) => {
      const target = await tx.schoolMembership.findFirst({ where: { id: membershipId, schoolId, status: 'ACTIVE' }, include: { roleGrants: true } });
      if (!target) throw new NotFoundException({ code: 'MEMBERSHIP_NOT_FOUND', message: 'Không tìm thấy membership đang hoạt động.' });
      await this.guardLastAdmin(tx, schoolId, target.id, []);
       await tx.schoolRoleGrant.deleteMany({ where: { schoolId, membershipId } }); await tx.schoolMembership.updateMany({ where: { id: membershipId, schoolId }, data: { status: 'REVOKED' } });
       await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: 'SCHOOL_MEMBERSHIP', reference: actor.membershipId, membershipId: actor.membershipId }, 'MEMBERSHIP_REVOKED', { operationId: op, targetMembershipId: membershipId }, reason) });
      return { membershipId, status: 'REVOKED' };
    });
  }
  async replaceRoles(identityId: string, schoolId: string, membershipId: string, key: string, operationId: string, body: { roles?: unknown; reason?: unknown }) {
    const actor = await this.actor(identityId, schoolId); const reason = typeof body.reason === 'string' ? body.reason.trim() : ''; const selectedRoles = this.roleSet(body.roles);
    if (!reason) throw new BadRequestException({ code: 'REASON_REQUIRED', message: 'Cần nêu lý do thay đổi quyền.' });
    return this.mutate(actor, identityId, schoolId, 'POST /api/app/schools/:schoolId/memberships/:membershipId/roles', key, operationId, { membershipId, roles: selectedRoles, reason }, async (tx, op) => {
      const target = await tx.schoolMembership.findFirst({ where: { id: membershipId, schoolId, status: 'ACTIVE' } }); if (!target) throw new NotFoundException({ code: 'MEMBERSHIP_NOT_FOUND', message: 'Không tìm thấy membership đang hoạt động.' });
      await this.guardLastAdmin(tx, schoolId, membershipId, selectedRoles);
      await tx.schoolRoleGrant.deleteMany({ where: { schoolId, membershipId } }); await tx.schoolRoleGrant.createMany({ data: selectedRoles.map((role) => ({ schoolId, membershipId, role })) });
       await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: 'SCHOOL_MEMBERSHIP', reference: actor.membershipId, membershipId: actor.membershipId }, 'MEMBERSHIP_ROLES_REPLACED', { operationId: op, targetMembershipId: membershipId, roles: selectedRoles }, reason) });
      return { membershipId, status: 'ACTIVE', roles: selectedRoles };
    });
  }
  async operation(identityId: string, schoolId: string, operationId: string) {
    if (!uuid.test(schoolId) || !uuid.test(operationId)) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Mã thao tác hoặc trường không hợp lệ.' });
    const activeSchool = await this.prisma.school.findFirst({ where: { id: schoolId, status: 'ACTIVE' }, select: { id: true } });
    if (!activeSchool) throw new NotFoundException({ code: 'OPERATION_NOT_FOUND', message: 'Không tìm thấy thao tác.' });
    const operation = await this.prisma.operation.findFirst({ where: { id: operationId, schoolId, actorIdentityId: identityId, actorType: 'SCHOOL_MEMBERSHIP' } });
    if (!operation) throw new NotFoundException({ code: 'OPERATION_NOT_FOUND', message: 'Không tìm thấy thao tác.' });
    try { await this.actor(identityId, schoolId); } catch {
      // A revoked actor may reconcile only its own already-recorded operation in this School.
      const actorMembership = await this.prisma.schoolMembership.findFirst({ where: { id: operation.membershipId!, schoolId, userIdentityId: identityId } });
      if (!actorMembership || operation.actorReference !== actorMembership.id) throw new NotFoundException({ code: 'OPERATION_NOT_FOUND', message: 'Không tìm thấy thao tác.' });
    }
    return { id: operation.id, status: operation.status, outcome: operation.outcome };
  }
  private async guardLastAdmin(tx: any, schoolId: string, targetId: string, nextRoles: Role[]) {
    const targetIsAdmin = await tx.schoolRoleGrant.count({ where: { schoolId, membershipId: targetId, role: 'SCHOOL_ADMIN' } });
    if (targetIsAdmin && !nextRoles.includes('SCHOOL_ADMIN')) { const admins = await tx.schoolRoleGrant.count({ where: { schoolId, role: 'SCHOOL_ADMIN', membership: { status: 'ACTIVE' } } }); if (admins <= 1) throw new ForbiddenException({ code: 'LAST_SCHOOL_ADMIN', message: 'Không thể thu hồi School Admin cuối cùng.' }); }
  }
  private async mutate(actor: { membershipId: string }, identityId: string, schoolId: string, route: string, key: string, operationId: string, body: unknown, work: (tx: any, operationId: string) => Promise<unknown>) {
    if (!uuid.test(key) || !uuid.test(operationId)) throw new UnauthorizedException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Cần Idempotency-Key và X-Operation-Id UUID.' });
     const requestFingerprintValue = requestFingerprint(body); const existing = await this.prisma.operation.findFirst({ where: { schoolId, actorReference: actor.membershipId, actorType: 'SCHOOL_MEMBERSHIP', route, idempotencyKey: key } });
     if (existing) { if (existing.fingerprint !== requestFingerprintValue) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key đã dùng cho yêu cầu khác.' }); return { id: existing.id, status: existing.status, outcome: existing.outcome }; }
        try { return await this.prisma.$transaction(async (tx) => { await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${schoolId}::uuid FOR UPDATE`; const activeSchool = await tx.school.findFirst({ where: { id: schoolId, status: 'ACTIVE' }, select: { id: true } }); if (!activeSchool) throw new NotFoundException({ code: 'SCHOOL_CONTEXT_DENIED', message: 'Không thể truy cập ngữ cảnh trường này.' }); const currentActor = await tx.schoolMembership.findFirst({ where: { id: actor.membershipId, schoolId, userIdentityId: identityId, status: 'ACTIVE', roleGrants: { some: { role: 'SCHOOL_ADMIN' } } } }); if (!currentActor) throw new ForbiddenException({ code: 'CAPABILITY_DENIED', message: 'Bạn không có quyền thực hiện thao tác này.' }); const operation = await tx.operation.create({ data: { id: operationId, schoolId, membershipId: actor.membershipId, actorIdentityId: identityId, actorType: 'SCHOOL_MEMBERSHIP', actorReference: actor.membershipId, route, idempotencyKey: key, fingerprint: requestFingerprintValue } }); const outcome = await work(tx, operation.id); const completed = await tx.operation.update({ where: { id: operation.id }, data: { status: 'COMPLETED', outcome: outcome as object } }); return { id: completed.id, status: completed.status, outcome: completed.outcome }; }); } catch (error) { if (!isOperationIdempotencyCollision(error)) throw error; const replay = await this.prisma.operation.findFirst({ where: { schoolId, actorReference: actor.membershipId, actorType: 'SCHOOL_MEMBERSHIP', route, idempotencyKey: key } }); if (replay?.fingerprint === requestFingerprintValue) return { id: replay.id, status: replay.status, outcome: replay.outcome }; throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Không thể xác nhận thao tác trùng lặp. Hãy đối soát thao tác trước khi thử lại.' }); }
  }
}
