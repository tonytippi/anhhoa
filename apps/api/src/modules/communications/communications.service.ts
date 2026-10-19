import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from "@nestjs/common";
import { createHash } from "node:crypto";
import { auditData } from "../common/audit.js";
import { requestFingerprint } from "../common/mutation-protection.js";
import { isOperationIdempotencyCollision } from "../common/operation-idempotency.js";
import { schoolFeatures, type SchoolKind } from "../common/school-features.js";
import { PrismaService } from "../identity/prisma.service.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
export const classNoteSaveRoute =
  "POST /api/teacher/schools/:schoolId/class-notes";
export const classNoteMediaUploadRoute =
  "POST /api/teacher/schools/:schoolId/class-note-media";
export const teacherMessageRoute =
  "POST /api/teacher/schools/:schoolId/students/:studentId/messages";
export const parentMessageRoute =
  "POST /api/parent/schools/:schoolId/students/:studentId/messages";
const classCapabilities = [
  "ATTENDANCE_WRITE",
  "DAILY_JOURNAL_WRITE",
  "PARENT_MESSAGE_WRITE",
  "CLASS_LEAVE_READ",
];
const maxMessageLength = 2000;
const maxNoteLength = 5000;
const messagePage = 200;
type Db =
  | PrismaService
  | { [key: string]: any; $queryRaw: PrismaService["$queryRaw"] };
type TeacherCapability = "DAILY_JOURNAL_WRITE" | "PARENT_MESSAGE_WRITE";
type Teacher = { id: string; staffProfileId: string; fullName: string };
type Party = "TEACHER" | "PARENT";

@Injectable()
export class CommunicationsService {
  constructor(private readonly prisma: PrismaService) {}

  private date(value: unknown, field: string) {
    if (
      typeof value !== "string" ||
      !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) !== value
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { [field]: "Ngày không hợp lệ." },
      });
    return value;
  }
  private day(value: string) {
    return new Date(`${value}T00:00:00.000Z`);
  }
  private today() {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: "Asia/Ho_Chi_Minh",
    }).format(new Date());
  }
  private denied(): never {
    throw new ForbiddenException({
      code: "CAPABILITY_DENIED",
      message: "Bạn không có quyền thực hiện thao tác này.",
    });
  }
  private effective(on: Date) {
    return {
      effectiveFrom: { lte: on },
      OR: [{ effectiveTo: null }, { effectiveTo: { gt: on } }],
    };
  }
  private enrolledIn(classId: string, on: Date) {
    return {
      lifecycle: "ENROLLED" as const,
      effectiveFrom: { lte: on },
      OR: [{ endedOn: null }, { endedOn: { gt: on } }],
      classAssignments: { some: { classId, ...this.effective(on) } },
    };
  }

  // Same binding chain as attendance: active membership, bound active StaffProfile, active position granting the capability, and an effective Class assignment.
  private async teacher(
    identityId: string,
    schoolId: string,
    capability: TeacherCapability | null,
    classId?: string,
    on?: string,
    tx: Db = this.prisma,
  ): Promise<Teacher> {
    const actor = await tx.schoolMembership.findFirst({
      where: {
        schoolId,
        userIdentityId: identityId,
        status: "ACTIVE",
        school: { status: "ACTIVE" },
        boundStaffProfile: {
          boundAt: { not: null },
          boundByMembershipId: { not: null },
          employmentStatus: "ACTIVE",
          primaryPosition: {
            status: "ACTIVE",
            grants: {
              some: {
                capability: capability ? capability : { in: classCapabilities },
              },
            },
          },
        },
      },
      select: {
        id: true,
        school: { select: { kind: true } },
        boundStaffProfile: { select: { id: true, fullName: true } },
      },
    });
    if (!actor?.boundStaffProfile) this.denied();
    if (
      capability === "DAILY_JOURNAL_WRITE" &&
      !schoolFeatures(actor.school.kind as SchoolKind).dailyJournal
    )
      throw new ConflictException({
        code: "SCHOOL_FEATURE_DISABLED",
        message: "Trường này không dùng tính năng này.",
      });
    if (classId !== undefined && on) {
      if (!uuid.test(classId)) this.denied();
      const assignment = await tx.staffClassAssignment.findFirst({
        where: {
          schoolId,
          staffProfileId: actor.boundStaffProfile.id,
          classId,
          ...this.effective(this.day(on)),
        },
        select: { id: true },
      });
      if (!assignment) this.denied();
    }
    return {
      id: actor.id,
      staffProfileId: actor.boundStaffProfile.id,
      fullName: actor.boundStaffProfile.fullName,
    };
  }
  private async parent(identityId: string, schoolId: string, tx: Db = this.prisma) {
    const parent = await tx.parentProfile.findFirst({
      where: { userIdentityId: identityId },
      select: { id: true, fullName: true },
    });
    if (!parent)
      throw new ForbiddenException({
        code: "PARENT_ACCESS_DENIED",
        message: "Không có quyền truy cập.",
      });
    const school = await tx.school.findFirst({
      where: { id: schoolId, status: "ACTIVE" },
      select: { id: true },
    });
    if (!school)
      throw new NotFoundException({
        code: "SCHOOL_CONTEXT_DENIED",
        message: "Không thể truy cập ngữ cảnh trường này.",
      });
    return parent;
  }
  private async parentLink(
    tx: Db,
    schoolId: string,
    parentProfileId: string,
    studentId: string,
    code: string,
    message: string,
  ) {
    const link = uuid.test(studentId)
      ? await tx.studentParent.findFirst({
          where: { schoolId, studentId, parentProfileId, status: "ACTIVE" },
          select: { relationshipLabel: true },
        })
      : null;
    if (!link) throw new NotFoundException({ code, message });
    return link;
  }
  private async studentInClass(
    tx: Db,
    schoolId: string,
    classId: string,
    studentId: string,
    on: string,
  ) {
    const enrollment = uuid.test(studentId)
      ? await tx.studentEnrollment.findFirst({
          where: { schoolId, studentId, ...this.enrolledIn(classId, this.day(on)) },
          select: { id: true, student: { select: { fullName: true } } },
        })
      : null;
    if (!enrollment)
      throw new ConflictException({
        code: "ROSTER_CONFLICT",
        message: "Học sinh không thuộc danh sách lớp trong ngày này.",
      });
    return enrollment;
  }
  // The Class a Student sits in on a day, for Parent projections; extracurricular groups are not Classes.
  private async classOf(tx: Db, schoolId: string, studentId: string, on: string) {
    const day = this.day(on);
    const assignment = await tx.enrollmentClassAssignment.findFirst({
      where: {
        schoolId,
        ...this.effective(day),
        enrollment: {
          studentId,
          lifecycle: "ENROLLED",
          effectiveFrom: { lte: day },
          OR: [{ endedOn: null }, { endedOn: { gt: day } }],
        },
      },
      orderBy: { effectiveFrom: "desc" },
      select: { classId: true, classroom: { select: { name: true } } },
    });
    return assignment
      ? { classId: assignment.classId as string, className: assignment.classroom.name as string }
      : null;
  }
  private mime(contentType: string | undefined, media: Buffer) {
    const jpeg = media.length >= 3 && media[0] === 0xff && media[1] === 0xd8 && media[2] === 0xff;
    const png =
      media.length >= 8 &&
      media.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    const webp =
      media.length >= 12 &&
      media.subarray(0, 4).toString("ascii") === "RIFF" &&
      media.subarray(8, 12).toString("ascii") === "WEBP";
    if (contentType === "image/jpeg" && jpeg) return "JPEG";
    if (contentType === "image/png" && png) return "PNG";
    if (contentType === "image/webp" && webp) return "WEBP";
    return null;
  }
  // Class notes follow the School's DailyJournal policy for date, operating day and image limits.
  private async notePolicy(tx: Db, schoolId: string, noteDate: string) {
    if (noteDate !== this.today())
      throw new ConflictException({
        code: "JOURNAL_DATE_NOT_CURRENT",
        message: "Chỉ có thể ghi nhận xét trong ngày hiện tại.",
      });
    const on = this.day(noteDate);
    const calendar = await tx.schoolCalendarVersion.findFirst({
      where: { schoolId, effectiveFrom: { lte: on } },
      include: { holidays: true },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!calendar)
      throw new ConflictException({
        code: "SCHOOL_CALENDAR_NOT_CONFIGURED",
        message: "Trường chưa cấu hình lịch vận hành.",
      });
    if (
      on.getUTCDay() === 0 ||
      calendar.holidays.some(
        (holiday: { startsOn: Date; endsOn: Date }) =>
          holiday.startsOn <= on && holiday.endsOn >= on,
      )
    )
      throw new ConflictException({
        code: "NON_OPERATING_DAY",
        message: "Không thể ghi nhận nhận xét ngày không vận hành.",
      });
    const policy = await tx.dailyJournalPolicy.findFirst({
      where: { schoolId, effectiveFrom: { lte: on } },
      orderBy: { effectiveFrom: "desc" },
    });
    if (!policy)
      throw new ConflictException({
        code: "DAILY_JOURNAL_POLICY_NOT_CONFIGURED",
        message: "Trường chưa cấu hình chính sách nhận xét hằng ngày.",
      });
    return policy as {
      acceptedImageMimeTypes: Array<"JPEG" | "PNG" | "WEBP">;
      maxImageSizeBytes: number;
      imageCountLimit: number | null;
    };
  }

  async teacherClasses(identityId: string, schoolId: string, date?: string) {
    const on = date ? this.date(date, "date") : this.today();
    const actor = await this.teacher(identityId, schoolId, null);
    const assignments = await this.prisma.staffClassAssignment.findMany({
      where: {
        schoolId,
        staffProfileId: actor.staffProfileId,
        ...this.effective(this.day(on)),
        classroom: { status: "ACTIVE" },
      },
      select: {
        classId: true,
        classroom: { select: { name: true } },
        schoolYearName: true,
      },
      orderBy: { className: "asc" },
    });
    const seen = new Set<string>();
    return {
      date: on,
      teacherName: actor.fullName,
      classes: assignments.flatMap((assignment) => {
        if (seen.has(assignment.classId)) return [];
        seen.add(assignment.classId);
        return [
          {
            classId: assignment.classId,
            className: assignment.classroom.name,
            schoolYearName: assignment.schoolYearName,
          },
        ];
      }),
    };
  }

  private noteDto(note: {
    id: string;
    classId: string;
    noteDate: Date;
    text: string;
    mediaIds: string[];
    currentVersion: number;
    updatedAt: Date;
  }, media: Array<{ id: string; contentType: string }>) {
    const byId = new Map(media.map((item) => [item.id, item]));
    return {
      id: note.id,
      classId: note.classId,
      noteDate: note.noteDate.toISOString().slice(0, 10),
      text: note.text,
      version: note.currentVersion,
      updatedAt: note.updatedAt.toISOString(),
      media: note.mediaIds.flatMap((id) => {
        const item = byId.get(id);
        return item ? [{ id: item.id, contentType: item.contentType }] : [];
      }),
    };
  }
  private async noteWithMedia(tx: Db, schoolId: string, classId: string, noteDate: string) {
    const note = await tx.classDailyNote.findFirst({
      where: { schoolId, classId, noteDate: this.day(noteDate) },
    });
    if (!note) return null;
    const media = await tx.classDailyNoteMedia.findMany({
      where: { schoolId, id: { in: note.mediaIds }, attachedNoteId: note.id },
      select: { id: true, contentType: true },
    });
    return this.noteDto(note, media);
  }
  async teacherClassNote(identityId: string, schoolId: string, classId: string, noteDate: string) {
    this.date(noteDate, "noteDate");
    await this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", classId, noteDate);
    return this.noteWithMedia(this.prisma, schoolId, classId, noteDate);
  }
  async uploadClassNoteMedia(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    classId: string,
    noteDate: string,
    contentType: string | undefined,
    media: unknown,
  ) {
    this.date(noteDate, "noteDate");
    if (!uuid.test(classId) || !Buffer.isBuffer(media) || media.length === 0 || !this.mime(contentType, media))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Tệp ảnh không hợp lệ.",
        fieldErrors: { media: "Tệp ảnh không hợp lệ." },
      });
    const actor = await this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", classId, noteDate);
    const bytes = new Uint8Array(media);
    return this.mutate(
      {
        actorType: "SCHOOL_MEMBERSHIP",
        actorReference: actor.id,
        membershipId: actor.id,
        route: classNoteMediaUploadRoute,
        identityId,
        schoolId,
        key,
        operationId,
        body: { classId, noteDate, contentType, size: bytes.byteLength },
        valid: (tx) => this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", classId, noteDate, tx),
      },
      async (tx, op) => {
        const current = await this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", classId, noteDate, tx);
        const policy = await this.notePolicy(tx, schoolId, noteDate);
        const mime = this.mime(contentType, media);
        if (!mime || media.length > policy.maxImageSizeBytes || !policy.acceptedImageMimeTypes.includes(mime))
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Tệp ảnh không hợp lệ.",
            fieldErrors: { media: "Ảnh không đáp ứng chính sách của trường." },
          });
        const record = await tx.classDailyNoteMedia.create({
          data: {
            schoolId,
            classId,
            noteDate: this.day(noteDate),
            contentType: contentType!,
            blob: bytes,
            uploadedByMembershipId: current.id,
            uploadedByStaffProfileId: current.staffProfileId,
          },
        });
        await tx.auditRecord.create({
          data: auditData(
            schoolId,
            { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id },
            "CLASS_NOTE_MEDIA_UPLOADED",
            { operationId: op, mediaId: record.id, classId, noteDate, contentType, size: bytes.byteLength },
          ),
        });
        return { id: record.id, contentType: record.contentType, classId, noteDate };
      },
    );
  }
  async saveClassNote(identityId: string, schoolId: string, key: string, operationId: string, body: unknown) {
    const input = body as { classId?: unknown; noteDate?: unknown; text?: unknown; mediaIds?: unknown };
    const classId = typeof input?.classId === "string" ? input.classId : "";
    const noteDate = this.date(input?.noteDate, "noteDate");
    const text = typeof input?.text === "string" ? input.text.trim() : "";
    const mediaIds =
      Array.isArray(input?.mediaIds) && input.mediaIds.every((id) => typeof id === "string" && uuid.test(id))
        ? (input.mediaIds as string[])
        : null;
    if (!uuid.test(classId) || !text || text.length > maxNoteLength || !mediaIds || new Set(mediaIds).size !== mediaIds.length)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          ...(!uuid.test(classId) ? { classId: "Lớp không hợp lệ." } : {}),
          ...(!text || text.length > maxNoteLength ? { text: `Nhận xét cần từ 1 đến ${maxNoteLength} ký tự.` } : {}),
          ...(!mediaIds || new Set(mediaIds).size !== mediaIds.length ? { mediaIds: "Ảnh không hợp lệ." } : {}),
        },
      });
    const actor = await this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", classId, noteDate);
    return this.mutate(
      {
        actorType: "SCHOOL_MEMBERSHIP",
        actorReference: actor.id,
        membershipId: actor.id,
        route: classNoteSaveRoute,
        identityId,
        schoolId,
        key,
        operationId,
        body: { classId, noteDate, text, mediaIds },
        valid: (tx) => this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", classId, noteDate, tx),
      },
      async (tx, op) => {
        const current = await this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", classId, noteDate, tx);
        const policy = await this.notePolicy(tx, schoolId, noteDate);
        if (policy.imageCountLimit !== null && mediaIds.length > policy.imageCountLimit)
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ.",
            fieldErrors: { mediaIds: `Chỉ được đính kèm tối đa ${policy.imageCountLimit} ảnh.` },
          });
        const on = this.day(noteDate);
        const existing = await tx.classDailyNote.findFirst({ where: { schoolId, classId, noteDate: on } });
        const media = await tx.classDailyNoteMedia.findMany({
          where: {
            schoolId,
            classId,
            noteDate: on,
            id: { in: mediaIds },
            OR: [
              { attachedNoteId: null, uploadedByMembershipId: current.id, uploadedByStaffProfileId: current.staffProfileId },
              ...(existing ? [{ attachedNoteId: existing.id }] : []),
            ],
          },
          select: { id: true, contentType: true },
        });
        if (media.length !== mediaIds.length)
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ.",
            fieldErrors: { mediaIds: "Ảnh không thuộc nhận xét này." },
          });
        const author = {
          text,
          mediaIds,
          actorIdentityId: identityId,
          membershipId: current.id,
          staffProfileId: current.staffProfileId,
        };
        const note = existing
          ? await tx.classDailyNote.update({
              where: { schoolId_id: { schoolId, id: existing.id } },
              data: { ...author, currentVersion: existing.currentVersion + 1 },
            })
          : await tx.classDailyNote.create({ data: { schoolId, classId, noteDate: on, ...author } });
        await tx.classDailyNoteMedia.updateMany({
          where: { schoolId, id: { in: mediaIds }, attachedNoteId: null },
          data: { attachedNoteId: note.id },
        });
        // Only the first publication of the day notifies Parents; later edits update the card silently.
        if (!existing) {
          const classroom = await tx.class.findFirst({ where: { schoolId, id: classId }, select: { name: true } });
          const roster = await tx.studentEnrollment.findMany({
            where: { schoolId, ...this.enrolledIn(classId, on) },
            select: { student: { select: { id: true, fullName: true } } },
          });
          for (const { student } of roster)
            await this.inboxEvent(tx, schoolId, "CLASS_NOTE", this.sourceId(note.id, student.id), student, noteDate, { className: classroom?.name ?? "" });
        }
        await tx.auditRecord.create({
          data: auditData(
            schoolId,
            { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id },
            "CLASS_NOTE_SAVED",
            { operationId: op, classNoteId: note.id, version: note.currentVersion, classId, noteDate, text, mediaIds },
          ),
        });
        return this.noteDto(note, media);
      },
    );
  }
  async readTeacherClassNoteMedia(identityId: string, schoolId: string, mediaId: string) {
    const media = uuid.test(mediaId)
      ? await this.prisma.classDailyNoteMedia.findFirst({ where: { id: mediaId, schoolId } })
      : null;
    if (!media)
      throw new NotFoundException({ code: "CLASS_NOTE_MEDIA_NOT_FOUND", message: "Không tìm thấy ảnh." });
    const actor = await this.teacher(
      identityId,
      schoolId,
      "DAILY_JOURNAL_WRITE",
      media.classId,
      media.noteDate.toISOString().slice(0, 10),
    );
    if (!media.attachedNoteId && media.uploadedByMembershipId !== actor.id) this.denied();
    return { contentType: media.contentType, blob: media.blob };
  }
  async parentClassNote(identityId: string, schoolId: string, studentId: string, noteDate?: string) {
    const on = noteDate ? this.date(noteDate, "noteDate") : this.today();
    return this.prisma.$transaction(
      async (tx) => {
        const parent = await this.parent(identityId, schoolId, tx);
        await this.parentLink(tx, schoolId, parent.id, studentId, "CLASS_NOTE_NOT_FOUND", "Không tìm thấy nhận xét.");
        const placement = await this.classOf(tx, schoolId, studentId, on);
        if (!placement) return null;
        const note = await this.noteWithMedia(tx, schoolId, placement.classId, on);
        if (!note) return null;
        return {
          className: placement.className,
          noteDate: note.noteDate,
          text: note.text,
          updatedAt: note.updatedAt,
          media: note.media,
        };
      },
      { isolationLevel: "RepeatableRead" },
    );
  }
  async readParentClassNoteMedia(identityId: string, schoolId: string, mediaId: string) {
    const missing = () =>
      new NotFoundException({ code: "CLASS_NOTE_MEDIA_NOT_FOUND", message: "Không tìm thấy ảnh." });
    const parent = await this.parent(identityId, schoolId);
    const media = uuid.test(mediaId)
      ? await this.prisma.classDailyNoteMedia.findFirst({ where: { id: mediaId, schoolId, attachedNoteId: { not: null } } })
      : null;
    if (!media) throw missing();
    const note = await this.prisma.classDailyNote.findFirst({
      where: { schoolId, id: media.attachedNoteId!, mediaIds: { has: media.id } },
      select: { classId: true, noteDate: true },
    });
    if (!note) throw missing();
    const links = await this.prisma.studentParent.findMany({
      where: { schoolId, parentProfileId: parent.id, status: "ACTIVE" },
      select: { studentId: true },
    });
    const on = note.noteDate.toISOString().slice(0, 10);
    for (const link of links) {
      const placement = await this.classOf(this.prisma, schoolId, link.studentId, on);
      if (placement?.classId === note.classId) return { contentType: media.contentType, blob: media.blob };
    }
    throw missing();
  }

  private messageText(body: unknown) {
    const text = typeof (body as { body?: unknown })?.body === "string" ? ((body as { body: string }).body).trim() : "";
    if (!text || text.length > maxMessageLength)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { body: `Tin nhắn cần từ 1 đến ${maxMessageLength} ký tự.` },
      });
    return text;
  }
  private async lastRead(tx: Db, schoolId: string, studentIds: string[], readerType: Party, readerReference: string) {
    const reads = await tx.studentMessageRead.findMany({
      where: { schoolId, studentId: { in: studentIds }, readerType, readerReference },
      select: { studentId: true, lastReadAt: true },
    });
    return new Map<string, Date>(reads.map((read: { studentId: string; lastReadAt: Date }) => [read.studentId, read.lastReadAt]));
  }
  private async unread(tx: Db, schoolId: string, studentIds: string[], readerType: Party, readerReference: string) {
    const reads = await this.lastRead(tx, schoolId, studentIds, readerType, readerReference);
    const other: Party = readerType === "TEACHER" ? "PARENT" : "TEACHER";
    const counts = new Map<string, number>();
    await Promise.all(
      studentIds.map(async (studentId) => {
        const since = reads.get(studentId);
        counts.set(
          studentId,
          await tx.studentMessage.count({
            where: { schoolId, studentId, senderType: other, ...(since ? { createdAt: { gt: since } } : {}) },
          }),
        );
      }),
    );
    return counts;
  }
  private async markRead(tx: Db, schoolId: string, studentId: string, readerType: Party, readerReference: string) {
    const now = new Date();
    await tx.studentMessageRead.upsert({
      where: {
        schoolId_studentId_readerType_readerReference: { schoolId, studentId, readerType, readerReference },
      },
      create: { schoolId, studentId, readerType, readerReference, lastReadAt: now },
      update: { lastReadAt: now },
    });
    return { studentId, readAt: now.toISOString() };
  }

  // Parent inbox events (AD-15 boundary): idempotent per source, carrying only the Class label and Student name snapshot.
  private sourceId(...parts: string[]) {
    const hex = createHash("sha1").update(parts.join(":")).digest("hex");
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${((parseInt(hex[16]!, 16) & 0x3) | 0x8).toString(16)}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
  }
  private async inboxEvent(
    tx: Db,
    schoolId: string,
    sourceType: "CLASS_NOTE" | "MESSAGE",
    sourceRecordId: string,
    student: { id: string; fullName: string },
    day: string,
    payload: Record<string, string>,
  ) {
    await tx.notificationSourceEvent.createMany({
      data: [
        {
          schoolId,
          sourceType,
          sourceRecordId,
          studentId: student.id,
          attendanceOn: this.day(day),
          studentDisplayNameSnapshot: student.fullName,
          payload: { schoolId, studentId: student.id, date: day, ...payload },
        },
      ],
      skipDuplicates: true,
    });
  }

  async teacherThreads(identityId: string, schoolId: string, classId: string) {
    const on = this.today();
    const actor = await this.teacher(identityId, schoolId, "PARENT_MESSAGE_WRITE", classId, on);
    const rows = await this.prisma.studentEnrollment.findMany({
      where: { schoolId, ...this.enrolledIn(classId, this.day(on)) },
      select: {
        studentId: true,
        student: {
          select: {
            fullName: true,
            studentCode: true,
            parentLinks: {
              where: { schoolId, status: "ACTIVE" },
              select: { relationshipLabel: true, parentProfile: { select: { fullName: true, userIdentityId: true } } },
            },
          },
        },
      },
      orderBy: [{ student: { fullName: "asc" } }],
    });
    const studentIds = rows.map((row) => row.studentId);
    const unread = await this.unread(this.prisma, schoolId, studentIds, "TEACHER", actor.staffProfileId);
    const latest = await Promise.all(
      studentIds.map((studentId) =>
        this.prisma.studentMessage.findFirst({
          where: { schoolId, studentId },
          orderBy: { createdAt: "desc" },
          select: { studentId: true, senderType: true, body: true, createdAt: true },
        }),
      ),
    );
    const lastByStudent = new Map(latest.flatMap((message) => (message ? [[message.studentId, message]] : [])));
    return {
      classId,
      students: rows.map((row) => {
        const last = lastByStudent.get(row.studentId);
        return {
          studentId: row.studentId,
          fullName: row.student.fullName,
          studentCode: row.student.studentCode,
          parents: row.student.parentLinks.map((link) => ({
            fullName: link.parentProfile.fullName,
            relationshipLabel: link.relationshipLabel,
            hasAccount: Boolean(link.parentProfile.userIdentityId),
          })),
          unreadCount: unread.get(row.studentId) ?? 0,
          lastMessage: last
            ? { senderType: last.senderType, body: last.body.slice(0, 160), createdAt: last.createdAt.toISOString() }
            : null,
        };
      }),
    };
  }
  private async teacherThreadAccess(identityId: string, schoolId: string, classId: string, studentId: string, tx: Db = this.prisma) {
    const on = this.today();
    const actor = await this.teacher(identityId, schoolId, "PARENT_MESSAGE_WRITE", classId, on, tx);
    const enrollment = await this.studentInClass(tx, schoolId, classId, studentId, on);
    return { actor, studentName: enrollment.student.fullName as string };
  }
  async teacherMessages(identityId: string, schoolId: string, classId: string, studentId: string) {
    const { actor } = await this.teacherThreadAccess(identityId, schoolId, classId, studentId);
    const messages = await this.prisma.studentMessage.findMany({
      where: { schoolId, studentId },
      orderBy: { createdAt: "desc" },
      take: messagePage,
    });
    const reads = await this.prisma.studentMessageRead.findMany({
      where: { schoolId, studentId, readerType: "PARENT" },
      select: { lastReadAt: true },
      orderBy: { lastReadAt: "desc" },
      take: 1,
    });
    return {
      studentId,
      parentReadAt: reads[0]?.lastReadAt.toISOString() ?? null,
      messages: messages.reverse().map((message) => ({
        id: message.id,
        senderType: message.senderType,
        senderName: message.senderName,
        senderLabel: message.senderLabel,
        mine: message.senderType === "TEACHER" && message.senderReference === actor.staffProfileId,
        body: message.body,
        createdAt: message.createdAt.toISOString(),
      })),
    };
  }
  async teacherSendMessage(identityId: string, schoolId: string, studentId: string, key: string, operationId: string, body: unknown) {
    const text = this.messageText(body);
    const classId = typeof (body as { classId?: unknown })?.classId === "string" ? (body as { classId: string }).classId : "";
    if (!uuid.test(classId) || !uuid.test(studentId))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { classId: "Lớp không hợp lệ." },
      });
    const { actor } = await this.teacherThreadAccess(identityId, schoolId, classId, studentId);
    return this.mutate(
      {
        actorType: "SCHOOL_MEMBERSHIP",
        actorReference: actor.id,
        membershipId: actor.id,
        route: teacherMessageRoute,
        identityId,
        schoolId,
        key,
        operationId,
        body: { classId, studentId, body: text },
        valid: (tx) => this.teacherThreadAccess(identityId, schoolId, classId, studentId, tx),
      },
      async (tx, op) => {
        const current = await this.teacher(identityId, schoolId, "PARENT_MESSAGE_WRITE", classId, this.today(), tx);
        const classroom = await tx.class.findFirst({ where: { schoolId, id: classId }, select: { name: true } });
        const message = await tx.studentMessage.create({
          data: {
            schoolId,
            studentId,
            senderType: "TEACHER",
            senderIdentityId: identityId,
            senderReference: current.staffProfileId,
            senderName: current.fullName,
            senderLabel: `Giáo viên lớp ${classroom?.name ?? ""}`.trim(),
            body: text,
            operationId: op,
          },
        });
        await this.markRead(tx, schoolId, studentId, "TEACHER", current.staffProfileId);
        const student = await tx.student.findFirst({ where: { schoolId, id: studentId }, select: { id: true, fullName: true } });
        if (student) await this.inboxEvent(tx, schoolId, "MESSAGE", message.id, student, this.today(), { className: classroom?.name ?? "" });
        await tx.auditRecord.create({
          data: auditData(
            schoolId,
            { identityId, type: "SCHOOL_MEMBERSHIP", reference: current.id, membershipId: current.id },
            "STUDENT_MESSAGE_SENT",
            { operationId: op, messageId: message.id, classId, studentId },
          ),
        });
        return { id: message.id, classId, studentId, createdAt: message.createdAt.toISOString() };
      },
    );
  }
  async teacherReadMessages(identityId: string, schoolId: string, classId: string, studentId: string) {
    const { actor } = await this.teacherThreadAccess(identityId, schoolId, classId, studentId);
    return this.markRead(this.prisma, schoolId, studentId, "TEACHER", actor.staffProfileId);
  }

  // Parents see the conversation of a linked Student; teacher messages carry only the Class label, never staff identity.
  private parentMessageDto(
    message: { id: string; senderType: Party; senderReference: string; senderLabel: string; body: string; createdAt: Date },
    parentProfileId: string,
  ) {
    return {
      id: message.id,
      senderType: message.senderType,
      senderLabel: message.senderLabel,
      mine: message.senderType === "PARENT" && message.senderReference === parentProfileId,
      body: message.body,
      createdAt: message.createdAt.toISOString(),
    };
  }
  async parentMessageSummary(identityId: string, schoolId: string) {
    const parent = await this.parent(identityId, schoolId);
    const links = await this.prisma.studentParent.findMany({
      where: { schoolId, parentProfileId: parent.id, status: "ACTIVE" },
      select: { studentId: true },
    });
    const studentIds = links.map((link) => link.studentId);
    const unread = await this.unread(this.prisma, schoolId, studentIds, "PARENT", parent.id);
    return studentIds.map((studentId) => ({ studentId, unreadCount: unread.get(studentId) ?? 0 }));
  }
  async parentMessages(identityId: string, schoolId: string, studentId: string) {
    const parent = await this.parent(identityId, schoolId);
    await this.parentLink(this.prisma, schoolId, parent.id, studentId, "MESSAGES_NOT_FOUND", "Không tìm thấy tin nhắn.");
    const messages = await this.prisma.studentMessage.findMany({
      where: { schoolId, studentId },
      orderBy: { createdAt: "desc" },
      take: messagePage,
    });
    const placement = await this.classOf(this.prisma, schoolId, studentId, this.today());
    return {
      studentId,
      canSend: Boolean(placement),
      className: placement?.className ?? null,
      messages: messages.reverse().map((message) => this.parentMessageDto(message, parent.id)),
    };
  }
  private async parentThreadAccess(identityId: string, schoolId: string, studentId: string, tx: Db = this.prisma) {
    const parent = await this.parent(identityId, schoolId, tx);
    const link = await this.parentLink(tx, schoolId, parent.id, studentId, "MESSAGES_NOT_FOUND", "Không tìm thấy tin nhắn.");
    if (!(await this.classOf(tx, schoolId, studentId, this.today())))
      throw new ConflictException({
        code: "ROSTER_CONFLICT",
        message: "Học sinh hiện không thuộc lớp nào để nhắn tin.",
      });
    return { parent, link };
  }
  async parentSendMessage(identityId: string, schoolId: string, studentId: string, key: string, operationId: string, body: unknown) {
    const text = this.messageText(body);
    const { parent } = await this.parentThreadAccess(identityId, schoolId, studentId);
    return this.mutate(
      {
        actorType: "PARENT_PROFILE",
        actorReference: parent.id,
        route: parentMessageRoute,
        identityId,
        schoolId,
        key,
        operationId,
        body: { studentId, body: text },
        valid: (tx) => this.parentThreadAccess(identityId, schoolId, studentId, tx),
      },
      async (tx, op) => {
        const { link } = await this.parentThreadAccess(identityId, schoolId, studentId, tx);
        const message = await tx.studentMessage.create({
          data: {
            schoolId,
            studentId,
            senderType: "PARENT",
            senderIdentityId: identityId,
            senderReference: parent.id,
            senderName: parent.fullName,
            senderLabel: link.relationshipLabel,
            body: text,
            operationId: op,
          },
        });
        await this.markRead(tx, schoolId, studentId, "PARENT", parent.id);
        await tx.auditRecord.create({
          data: auditData(
            schoolId,
            { identityId, type: "PARENT_PROFILE", reference: parent.id },
            "STUDENT_MESSAGE_SENT",
            { operationId: op, messageId: message.id, studentId },
          ),
        });
        return { id: message.id, studentId, createdAt: message.createdAt.toISOString() };
      },
    );
  }
  async parentReadMessages(identityId: string, schoolId: string, studentId: string) {
    const parent = await this.parent(identityId, schoolId);
    await this.parentLink(this.prisma, schoolId, parent.id, studentId, "MESSAGES_NOT_FOUND", "Không tìm thấy tin nhắn.");
    // Reading the conversation also clears its message notifications in the Parent inbox.
    const events = await this.prisma.notificationSourceEvent.findMany({
      where: { schoolId, studentId, sourceType: "MESSAGE", inboxReads: { none: { schoolId, parentProfileId: parent.id } } },
      select: { id: true },
    });
    if (events.length)
      await this.prisma.parentInboxEventRead.createMany({
        data: events.map((event) => ({ schoolId, parentProfileId: parent.id, notificationSourceEventId: event.id, studentId })),
        skipDuplicates: true,
      });
    return this.markRead(this.prisma, schoolId, studentId, "PARENT", parent.id);
  }

  // Reconciliation re-authorizes against the Class or Student the Operation touched.
  async authorizeTeacherOperation(identityId: string, schoolId: string, route: string, outcome: unknown) {
    const value = outcome as { classId?: unknown; noteDate?: unknown; studentId?: unknown } | null;
    if (typeof value?.classId !== "string") return false;
    if (route === classNoteSaveRoute || route === classNoteMediaUploadRoute) {
      if (typeof value.noteDate !== "string") return false;
      await this.teacher(identityId, schoolId, "DAILY_JOURNAL_WRITE", value.classId, value.noteDate);
      return true;
    }
    if (route === teacherMessageRoute) {
      if (typeof value.studentId !== "string") return false;
      await this.teacher(identityId, schoolId, "PARENT_MESSAGE_WRITE", value.classId, this.today());
      return true;
    }
    return false;
  }

  private async mutate(
    input: {
      actorType: "PARENT_PROFILE" | "SCHOOL_MEMBERSHIP";
      actorReference: string;
      membershipId?: string;
      route: string;
      identityId: string;
      schoolId: string;
      key: string;
      operationId: string;
      body: unknown;
      valid: (tx: Db) => Promise<unknown>;
    },
    work: (tx: Db, operationId: string) => Promise<unknown>,
  ) {
    if (!uuid.test(input.key) || !uuid.test(input.operationId))
      throw new UnauthorizedException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Cần Idempotency-Key và X-Operation-Id UUID.",
      });
    const fingerprint = requestFingerprint(input.body);
    const replay = async () => {
      await input.valid(this.prisma);
      const existing = await this.prisma.operation.findFirst({
        where: {
          schoolId: input.schoolId,
          actorType: input.actorType,
          actorReference: input.actorReference,
          route: input.route,
          idempotencyKey: input.key,
        },
      });
      if (!existing) return null;
      if (existing.fingerprint !== fingerprint)
        throw new ConflictException({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency-Key đã dùng cho yêu cầu khác.",
        });
      return { id: existing.id, status: existing.status, outcome: existing.outcome };
    };
    const existing = await replay();
    if (existing) return existing;
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${input.schoolId}::uuid FOR UPDATE`;
        await input.valid(tx);
        const operation = await tx.operation.create({
          data: {
            id: input.operationId,
            schoolId: input.schoolId,
            membershipId: input.membershipId,
            actorIdentityId: input.identityId,
            actorType: input.actorType,
            actorReference: input.actorReference,
            route: input.route,
            idempotencyKey: input.key,
            fingerprint,
          },
        });
        const outcome = await work(tx, operation.id);
        const completed = await tx.operation.update({
          where: { id: operation.id },
          data: { status: "COMPLETED", outcome: outcome as object },
        });
        return { id: completed.id, status: completed.status, outcome: completed.outcome };
      });
    } catch (error) {
      if (isOperationIdempotencyCollision(error)) {
        const value = await replay();
        if (value) return value;
      }
      if (
        (error as { code?: unknown })?.code === "P2002" &&
        JSON.stringify((error as { meta?: unknown })?.meta).includes("ClassDailyNote")
      )
        throw new ConflictException({
          code: "CLASS_NOTE_CONCURRENT_SAVE",
          message: "Nhận xét chung vừa được cập nhật. Hãy tải lại trước khi lưu tiếp.",
        });
      throw error;
    }
  }
}
