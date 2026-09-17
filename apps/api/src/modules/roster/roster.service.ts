import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException, UnauthorizedException } from '@nestjs/common';
import { auditData } from '../common/audit.js';
import { requestFingerprint } from '../common/mutation-protection.js';
import { isOperationIdempotencyCollision } from '../common/operation-idempotency.js';
import { AuthorizationService } from '../authorization/authorization.service.js';
import { PrismaService } from '../identity/prisma.service.js';

const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const route = {
  schoolYear: 'POST /api/app/schools/:schoolId/roster/school-years',
  class: 'POST /api/app/schools/:schoolId/roster/school-years/:schoolYearId/classes',
  rename: 'POST /api/app/schools/:schoolId/roster/classes/:classId/name',
};

@Injectable()
export class RosterService {
  constructor(private readonly prisma: PrismaService, private readonly authorization: AuthorizationService) {}
  private async actor(identityId: string, schoolId: string) { return this.authorization.resolve(identityId, schoolId, 'app', 'ROSTER_MANAGE'); }
  private name(value: unknown, field = 'name') {
    const name = typeof value === 'string' ? value.trim() : '';
    if (!name || name.length > 100) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ.', fieldErrors: { [field]: 'Tên cần từ 1 đến 100 ký tự.' } });
    return name;
  }
  private date(value: unknown, field: string) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ.', fieldErrors: { [field]: 'Ngày không hợp lệ.' } });
    return value;
  }
  private schoolYearDto(value: { id: string; name: string; startsOn: Date; endsOn: Date }) {
    const parts = new Intl.DateTimeFormat('en-US', { timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date());
    const today = `${parts.find((part) => part.type === 'year')!.value}-${parts.find((part) => part.type === 'month')!.value}-${parts.find((part) => part.type === 'day')!.value}`;
    return { id: value.id, name: value.name, startsOn: value.startsOn.toISOString().slice(0, 10), endsOn: value.endsOn.toISOString().slice(0, 10), isActive: value.startsOn.toISOString().slice(0, 10) <= today && today < value.endsOn.toISOString().slice(0, 10) };
  }
  private classDto(value: { id: string; schoolYearId: string; name: string; status: string; createdAt: Date; updatedAt: Date }) {
    return { id: value.id, schoolYearId: value.schoolYearId, name: value.name, status: value.status, createdAt: value.createdAt.toISOString(), updatedAt: value.updatedAt.toISOString() };
  }
  async schoolYears(identityId: string, schoolId: string) { await this.actor(identityId, schoolId); return (await this.prisma.schoolYear.findMany({ where: { schoolId }, orderBy: { startsOn: 'desc' } })).map((year) => this.schoolYearDto(year)); }
  async classes(identityId: string, schoolId: string, schoolYearId: string) { await this.actor(identityId, schoolId); if (!uuid.test(schoolYearId)) throw new NotFoundException({ code: 'SCHOOL_YEAR_NOT_FOUND', message: 'Không tìm thấy năm học.' }); const year = await this.prisma.schoolYear.findFirst({ where: { id: schoolYearId, schoolId }, select: { id: true } }); if (!year) throw new NotFoundException({ code: 'SCHOOL_YEAR_NOT_FOUND', message: 'Không tìm thấy năm học.' }); return (await this.prisma.class.findMany({ where: { schoolId, schoolYearId }, select: { id: true, schoolYearId: true, name: true, status: true, createdAt: true, updatedAt: true }, orderBy: { createdAt: 'asc' } })).map((classroom) => this.classDto(classroom)); }
  async createSchoolYear(identityId: string, schoolId: string, key: string, operationId: string, body: any) {
    const actor = await this.actor(identityId, schoolId); const name = this.name(body?.name); const startsOn = this.date(body?.startsOn, 'startsOn'); const endsOn = this.date(body?.endsOn, 'endsOn');
    if (startsOn >= endsOn) throw new BadRequestException({ code: 'VALIDATION_ERROR', message: 'Dữ liệu không hợp lệ.', fieldErrors: { endsOn: 'Ngày kết thúc phải sau ngày bắt đầu.' } });
    return this.mutate(actor, identityId, schoolId, route.schoolYear, key, operationId, { name, startsOn, endsOn }, async (tx, operation) => { const year = await tx.schoolYear.create({ data: { schoolId, name, startsOn: new Date(`${startsOn}T00:00:00.000Z`), endsOn: new Date(`${endsOn}T00:00:00.000Z`) } }); await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: 'SCHOOL_MEMBERSHIP', reference: actor.membershipId, membershipId: actor.membershipId }, 'SCHOOL_YEAR_CREATED', { operationId: operation, schoolYearId: year.id }) }); return this.schoolYearDto(year); });
  }
  async createClass(identityId: string, schoolId: string, schoolYearId: string, key: string, operationId: string, body: any) {
    const actor = await this.actor(identityId, schoolId); const name = this.name(body?.name);
    return this.mutate(actor, identityId, schoolId, route.class, key, operationId, { schoolYearId, name }, async (tx, operation) => { const year = await tx.schoolYear.findFirst({ where: { id: schoolYearId, schoolId }, select: { id: true } }); if (!year) throw new NotFoundException({ code: 'SCHOOL_YEAR_NOT_FOUND', message: 'Không tìm thấy năm học.' }); const classroom = await tx.class.create({ data: { schoolId, schoolYearId, name } }); await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: 'SCHOOL_MEMBERSHIP', reference: actor.membershipId, membershipId: actor.membershipId }, 'CLASS_CREATED', { operationId: operation, classId: classroom.id, schoolYearId }) }); return this.classDto(classroom); });
  }
  async renameClass(identityId: string, schoolId: string, classId: string, key: string, operationId: string, body: any) {
    const actor = await this.actor(identityId, schoolId); if (!uuid.test(classId)) throw new NotFoundException({ code: 'CLASS_NOT_FOUND', message: 'Không tìm thấy lớp.' }); const name = this.name(body?.name);
    return this.mutate(actor, identityId, schoolId, route.rename, key, operationId, { classId, name }, async (tx, operation) => { const result = await tx.class.updateMany({ where: { id: classId, schoolId }, data: { name } }); if (!result.count) throw new NotFoundException({ code: 'CLASS_NOT_FOUND', message: 'Không tìm thấy lớp.' }); const classroom = await tx.class.findFirstOrThrow({ where: { id: classId, schoolId } }); await tx.auditRecord.create({ data: auditData(schoolId, { identityId, type: 'SCHOOL_MEMBERSHIP', reference: actor.membershipId, membershipId: actor.membershipId }, 'CLASS_RENAMED', { operationId: operation, classId }) }); return this.classDto(classroom); });
  }
  private async mutate(actor: { membershipId: string }, identityId: string, schoolId: string, command: string, key: string, operationId: string, body: unknown, work: (tx: any, operationId: string) => Promise<unknown>) {
    if (!uuid.test(key) || !uuid.test(operationId)) throw new UnauthorizedException({ code: 'IDEMPOTENCY_KEY_REQUIRED', message: 'Cần Idempotency-Key và X-Operation-Id UUID.' });
    const fingerprint = requestFingerprint(body); const existing = await this.prisma.operation.findFirst({ where: { schoolId, actorReference: actor.membershipId, actorType: 'SCHOOL_MEMBERSHIP', route: command, idempotencyKey: key } }); if (existing) { if (existing.fingerprint !== fingerprint) throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Idempotency-Key đã dùng cho yêu cầu khác.' }); return { id: existing.id, status: existing.status, outcome: existing.outcome }; }
    try { return await this.prisma.$transaction(async (tx) => { await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${schoolId}::uuid FOR UPDATE`; const active = await tx.school.findFirst({ where: { id: schoolId, status: 'ACTIVE' }, select: { id: true } }); if (!active) throw new NotFoundException({ code: 'SCHOOL_CONTEXT_DENIED', message: 'Không thể truy cập ngữ cảnh trường này.' }); const current = await tx.schoolMembership.findFirst({ where: { id: actor.membershipId, schoolId, userIdentityId: identityId, status: 'ACTIVE', roleGrants: { some: { role: 'SCHOOL_ADMIN' } } } }); if (!current) throw new ForbiddenException({ code: 'CAPABILITY_DENIED', message: 'Bạn không có quyền thực hiện thao tác này.' }); const op = await tx.operation.create({ data: { id: operationId, schoolId, membershipId: actor.membershipId, actorIdentityId: identityId, actorType: 'SCHOOL_MEMBERSHIP', actorReference: actor.membershipId, route: command, idempotencyKey: key, fingerprint } }); const outcome = await work(tx, op.id); const completed = await tx.operation.update({ where: { id: op.id }, data: { status: 'COMPLETED', outcome: outcome as object } }); return { id: completed.id, status: completed.status, outcome: completed.outcome }; }); } catch (error: any) { if (error?.meta?.driverAdapterError?.cause?.code === '23P01') throw new ConflictException({ code: 'SCHOOL_YEAR_OVERLAP', message: 'Khoảng thời gian năm học bị chồng lấn.' }); if (!isOperationIdempotencyCollision(error)) throw error; const replay = await this.prisma.operation.findFirst({ where: { schoolId, actorReference: actor.membershipId, actorType: 'SCHOOL_MEMBERSHIP', route: command, idempotencyKey: key } }); if (replay?.fingerprint === fingerprint) return { id: replay.id, status: replay.status, outcome: replay.outcome }; throw new ConflictException({ code: 'IDEMPOTENCY_CONFLICT', message: 'Không thể xác nhận thao tác trùng lặp. Hãy đối soát thao tác trước khi thử lại.' }); }
  }
}
