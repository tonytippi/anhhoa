import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  UnauthorizedException,
} from "@nestjs/common";
import { AuthorizationService } from "../authorization/authorization.service.js";
import { auditData } from "../common/audit.js";
import { requestFingerprint } from "../common/mutation-protection.js";
import { isOperationIdempotencyCollision } from "../common/operation-idempotency.js";
import { PrismaService } from "../identity/prisma.service.js";

const uuid =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const routes = {
  profile: "POST /api/app/schools/:schoolId/settings/profile-versions",
  calendar: "POST /api/app/schools/:schoolId/settings/calendar-versions",
  financePolicy:
    "POST /api/app/schools/:schoolId/settings/finance-policy-versions",
  attendancePolicy:
    "POST /api/app/schools/:schoolId/settings/attendance-policy-versions",
  handoverPolicy:
    "POST /api/app/schools/:schoolId/settings/handover-policy-versions",
  dailyJournalPolicy:
    "POST /api/app/schools/:schoolId/settings/daily-journal-policy-versions",
  leavePolicy: "POST /api/app/schools/:schoolId/settings/leave-policy-versions",
  bankAccount: "POST /api/app/schools/:schoolId/settings/bank-accounts",
  bankAccountLifecycle:
    "POST /api/app/schools/:schoolId/settings/bank-accounts/:bankAccountId/lifecycle",
};
const transferTemplate = "{{studentName}} {{className}}";
const dailyJournalPolicyFacts = {
  parentRetentionDaysAfterEnrollmentEnded: 30,
  acceptedImageMimeTypes: ["JPEG", "PNG", "WEBP"],
  maxImageSizeBytes: 10485760,
  imageCountLimit: null,
};

@Injectable()
export class SettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly authorization: AuthorizationService,
  ) {}
  private async actor(identityId: string, schoolId: string) {
    return this.authorization.resolve(
      identityId,
      schoolId,
      "app",
      "SETTINGS_MANAGE",
    );
  }
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
  private text(value: unknown, field: string, required = true, limit = 200) {
    const text = typeof value === "string" ? value.trim() : "";
    if ((required && !text) || text.length > limit)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          [field]: required
            ? `Cần từ 1 đến ${limit} ký tự.`
            : `Không quá ${limit} ký tự.`,
        },
      });
    return text || null;
  }
  private today() {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Ho_Chi_Minh",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(new Date());
    return `${parts.find((part) => part.type === "year")!.value}-${parts.find((part) => part.type === "month")!.value}-${parts.find((part) => part.type === "day")!.value}`;
  }
  private profileDto(value: any) {
    return (
      value && {
        id: value.id,
        effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
        schoolName: value.schoolName,
        address: value.address,
        phone: value.phone,
        createdAt: value.createdAt.toISOString(),
      }
    );
  }
  private calendarDto(value: any) {
    return (
      value && {
        id: value.id,
        effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
        workweek: [
          "MONDAY",
          "TUESDAY",
          "WEDNESDAY",
          "THURSDAY",
          "FRIDAY",
          "SATURDAY",
        ],
        nonOperatingWeekdays: ["SUNDAY"],
        createdAt: value.createdAt.toISOString(),
        holidays: value.holidays.map((holiday: any) => ({
          id: holiday.id,
          name: holiday.name,
          startsOn: holiday.startsOn.toISOString().slice(0, 10),
          endsOn: holiday.endsOn.toISOString().slice(0, 10),
        })),
      }
    );
  }
  private financePolicyDto(value: any) {
    return (
      value && {
        id: value.id,
        effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
        dueDaysAfterIssue: value.dueDaysAfterIssue,
        taxTreatment: value.taxTreatment,
        debtScope: value.debtScope,
        reversalMode: value.reversalMode,
        reason: value.reason,
        createdAt: value.createdAt.toISOString(),
      }
    );
  }
  private evidencePolicyDto(value: any) {
    return (
      value && {
        id: value.id,
        effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
        photoEvidenceMode: value.photoEvidenceMode,
        reason: value.reason,
        createdAt: value.createdAt.toISOString(),
      }
    );
  }
  private dailyJournalPolicyDto(value: any) {
    return (
      value && {
        id: value.id,
        effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
        reason: value.reason,
        parentRetentionDaysAfterEnrollmentEnded:
          value.parentRetentionDaysAfterEnrollmentEnded,
        acceptedImageMimeTypes: value.acceptedImageMimeTypes,
        maxImageSizeBytes: value.maxImageSizeBytes,
        imageCountLimit: value.imageCountLimit,
        createdAt: value.createdAt.toISOString(),
      }
    );
  }
  private leavePolicyDto(value: any) {
    return (
      value && {
        id: value.id,
        effectiveFrom: value.effectiveFrom.toISOString().slice(0, 10),
        nextDayDeadlineLocalTime: value.nextDayDeadlineLocalTime,
        createdAt: value.createdAt.toISOString(),
      }
    );
  }
  private transitionDto(value: any) {
    return {
      previousStatus: value.previousStatus,
      status: value.status,
      reason: value.reason,
      changedAt: value.changedAt.toISOString(),
    };
  }
  private bankAccountDto(value: any) {
    const lifecycleTransitions = (value.lifecycleTransitions ?? []).map(
      (transition: any) => this.transitionDto(transition),
    );
    const latest = lifecycleTransitions[0];
    return {
      id: value.id,
      receivingBank: value.receivingBank,
      accountNumber: value.accountNumber,
      accountHolderName: value.accountHolderName,
      transferTemplate: value.transferTemplate,
      status: latest?.status ?? null,
      createdAt: value.createdAt.toISOString(),
      lifecycleTransitions,
    };
  }
  async read(identityId: string, schoolId: string, asOf?: string) {
    await this.actor(identityId, schoolId);
    const day = asOf ? this.date(asOf, "asOf") : this.today();
    const where = {
      schoolId,
      effectiveFrom: { lte: new Date(`${day}T00:00:00.000Z`) },
    };
    const transitionAsOf = new Date(`${day}T16:59:59.999Z`);
    const [
      profile,
      calendar,
      financePolicies,
      attendancePolicies,
      handoverPolicies,
      dailyJournalPolicies,
      leavePolicies,
      bankAccounts,
    ] = await Promise.all([
      this.prisma.schoolProfileVersion.findFirst({
        where,
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.schoolCalendarVersion.findFirst({
        where,
        include: { holidays: { orderBy: { startsOn: "asc" } } },
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.financePolicy.findMany({
        where: { schoolId },
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.attendancePolicy.findMany({
        where: { schoolId },
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.handoverPolicy.findMany({
        where: { schoolId },
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.dailyJournalPolicy.findMany({
        where: { schoolId },
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.leavePolicy.findMany({
        where: { schoolId },
        orderBy: { effectiveFrom: "desc" },
      }),
      this.prisma.bankAccount.findMany({
        where: { schoolId },
        include: {
          lifecycleTransitions: {
            where: { changedAt: { lte: transitionAsOf } },
            orderBy: { sequence: "desc" },
          },
        },
        orderBy: { createdAt: "desc" },
      }),
    ]);
    const policies = financePolicies.map((policy: any) =>
      this.financePolicyDto(policy),
    );
    const financePolicy =
      policies.find((policy: any) => policy.effectiveFrom <= day) ?? null;
    const attendancePolicyVersions = attendancePolicies.map((policy: any) =>
      this.evidencePolicyDto(policy),
    );
    const handoverPolicyVersions = handoverPolicies.map((policy: any) =>
      this.evidencePolicyDto(policy),
    );
    const dailyJournalPolicyVersions = dailyJournalPolicies.map((policy: any) =>
      this.dailyJournalPolicyDto(policy),
    );
    const leavePolicyVersions = leavePolicies.map((policy: any) =>
      this.leavePolicyDto(policy),
    );
    return {
      asOf: day,
      timezone: "Asia/Ho_Chi_Minh",
      profile: this.profileDto(profile),
      calendar: this.calendarDto(calendar),
      financePolicy,
      financePolicyVersions: policies,
      attendancePolicy:
        attendancePolicyVersions.find(
          (policy: any) => policy.effectiveFrom <= day,
        ) ?? null,
      attendancePolicyVersions,
      handoverPolicy:
        handoverPolicyVersions.find(
          (policy: any) => policy.effectiveFrom <= day,
        ) ?? null,
      handoverPolicyVersions,
      dailyJournalPolicy:
        dailyJournalPolicyVersions.find(
          (policy: any) => policy.effectiveFrom <= day,
        ) ?? null,
      dailyJournalPolicyVersions,
      leavePolicy:
        leavePolicyVersions.find(
          (policy: any) => policy.effectiveFrom <= day,
        ) ?? null,
      leavePolicyVersions,
      bankAccounts: bankAccounts
        .map((account: any) => this.bankAccountDto(account))
        .filter((account: any) => account.status),
    };
  }
  async createProfile(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const input = {
      effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom"),
      schoolName: this.text(body?.schoolName, "schoolName")!,
      address: this.text(body?.address, "address", false, 500),
      phone: this.text(body?.phone, "phone", false, 30),
    };
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.profile,
      key,
      operationId,
      input,
      async (tx, operation) => {
        const prior = await tx.schoolProfileVersion.findFirst({
          where: {
            schoolId,
            effectiveFrom: {
              lt: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
            },
          },
          orderBy: { effectiveFrom: "desc" },
        });
        try {
          const profile = await tx.schoolProfileVersion.create({
            data: {
              schoolId,
              ...input,
              effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
              actorIdentityId: identityId,
              membershipId: actor.membershipId,
            },
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "SCHOOL_PROFILE_VERSION_CREATED",
            operation,
            {
              oldValue: this.profileDto(prior),
              newValue: this.profileDto(profile),
            },
          );
          return this.profileDto(profile);
        } catch (error) {
          if (this.unique(error))
            throw new BadRequestException({
              code: "VALIDATION_ERROR",
              message: "Dữ liệu không hợp lệ.",
              fieldErrors: {
                effectiveFrom: "Đã có phiên bản tại ngày hiệu lực này.",
              },
            });
          throw error;
        }
      },
    );
  }
  async createCalendar(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const effectiveFrom = this.date(body?.effectiveFrom, "effectiveFrom");
    const holidays = Array.isArray(body?.holidays)
      ? body.holidays.map((item: any) => ({
          name: this.text(item?.name, "holidayName")!,
          startsOn: this.date(item?.startsOn, "startsOn"),
          endsOn: this.date(item?.endsOn, "endsOn"),
        }))
      : [];
    for (const holiday of holidays)
      if (holiday.endsOn < holiday.startsOn)
        throw new BadRequestException({
          code: "VALIDATION_ERROR",
          message: "Dữ liệu không hợp lệ.",
          fieldErrors: {
            endsOn: "Ngày kết thúc không được trước ngày bắt đầu.",
          },
        });
    for (const [index, holiday] of holidays.entries())
      for (const other of holidays.slice(index + 1))
        if (
          holiday.startsOn <= other.endsOn &&
          other.startsOn <= holiday.endsOn
        )
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ.",
            fieldErrors: { startsOn: "Các khoảng nghỉ không được chồng lấn." },
          });
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.calendar,
      key,
      operationId,
      { effectiveFrom, holidays },
      async (tx, operation) => {
        const prior = await tx.schoolCalendarVersion.findFirst({
          where: {
            schoolId,
            effectiveFrom: { lt: new Date(`${effectiveFrom}T00:00:00.000Z`) },
          },
          include: { holidays: true },
          orderBy: { effectiveFrom: "desc" },
        });
        try {
          const calendar = await tx.schoolCalendarVersion.create({
            data: {
              schoolId,
              effectiveFrom: new Date(`${effectiveFrom}T00:00:00.000Z`),
              actorIdentityId: identityId,
              membershipId: actor.membershipId,
              holidays: {
                create: holidays.map(
                  (holiday: {
                    name: string;
                    startsOn: string;
                    endsOn: string;
                  }) => ({
                    ...holiday,
                    startsOn: new Date(`${holiday.startsOn}T00:00:00.000Z`),
                    endsOn: new Date(`${holiday.endsOn}T00:00:00.000Z`),
                  }),
                ),
              },
            },
            include: { holidays: { orderBy: { startsOn: "asc" } } },
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "SCHOOL_CALENDAR_VERSION_CREATED",
            operation,
            {
              oldValue: this.calendarDto(prior),
              newValue: this.calendarDto(calendar),
            },
          );
          return this.calendarDto(calendar);
        } catch (error) {
          if (this.unique(error))
            throw new BadRequestException({
              code: "VALIDATION_ERROR",
              message: "Dữ liệu không hợp lệ.",
              fieldErrors: {
                effectiveFrom: "Đã có phiên bản tại ngày hiệu lực này.",
              },
            });
          throw error;
        }
      },
    );
  }
  async createFinancePolicy(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const dueDaysAfterIssue = body?.dueDaysAfterIssue;
    if (
      !Number.isInteger(dueDaysAfterIssue) ||
      dueDaysAfterIssue < 0 ||
      dueDaysAfterIssue > 365
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { dueDaysAfterIssue: "Cần là số nguyên từ 0 đến 365." },
      });
    const taxTreatment = body?.taxTreatment;
    const debtScope = body?.debtScope;
    const reversalMode = body?.reversalMode;
    if (
      !["NOT_APPLICABLE", "TAX_INCLUDED", "TAX_EXCLUDED"].includes(
        taxTreatment,
      ) ||
      debtScope !== "CURRENT_SCHOOL_YEAR_ONLY" ||
      !["DIRECT", "SCHOOL_ADMIN_APPROVAL"].includes(reversalMode)
    )
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { financePolicy: "Chính sách tài chính không hợp lệ." },
      });
    const input = {
      effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom"),
      dueDaysAfterIssue,
      taxTreatment,
      debtScope,
      reversalMode,
      reason: this.text(body?.reason, "reason", false, 500),
    };
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.financePolicy,
      key,
      operationId,
      input,
      async (tx, operation) => {
        const prior = await tx.financePolicy.findFirst({
          where: {
            schoolId,
            effectiveFrom: {
              lt: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
            },
          },
          orderBy: { effectiveFrom: "desc" },
        });
        try {
          const policy = await tx.financePolicy.create({
            data: {
              schoolId,
              ...input,
              effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
              actorIdentityId: identityId,
              membershipId: actor.membershipId,
            },
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "FINANCE_POLICY_VERSION_CREATED",
            operation,
            {
              oldValue: this.financePolicyDto(prior),
              newValue: this.financePolicyDto(policy),
            },
          );
          return this.financePolicyDto(policy);
        } catch (error) {
          if (this.unique(error))
            throw new BadRequestException({
              code: "VALIDATION_ERROR",
              message: "Dữ liệu không hợp lệ.",
              fieldErrors: {
                effectiveFrom: "Đã có phiên bản tại ngày hiệu lực này.",
              },
            });
          throw error;
        }
      },
    );
  }
  async createAttendancePolicy(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    return this.createEvidencePolicy(
      "attendancePolicy",
      "ATTENDANCE_POLICY_VERSION_CREATED",
      identityId,
      schoolId,
      key,
      operationId,
      body,
    );
  }
  async createHandoverPolicy(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    return this.createEvidencePolicy(
      "handoverPolicy",
      "HANDOVER_POLICY_VERSION_CREATED",
      identityId,
      schoolId,
      key,
      operationId,
      body,
    );
  }
  private async createEvidencePolicy(
    kind: "attendancePolicy" | "handoverPolicy",
    action: string,
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const photoEvidenceMode = body?.photoEvidenceMode;
    if (!["REQUIRED", "OPTIONAL"].includes(photoEvidenceMode))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          photoEvidenceMode: "Chỉ chấp nhận Bắt buộc hoặc Tùy chọn.",
        },
      });
    const input = {
      effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom"),
      photoEvidenceMode,
      reason: this.text(body?.reason, "reason", true, 500)!,
    };
    const model =
      kind === "attendancePolicy" ? "attendancePolicy" : "handoverPolicy";
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes[kind],
      key,
      operationId,
      input,
      async (tx, operation) => {
        const prior = await tx[model].findFirst({
          where: {
            schoolId,
            effectiveFrom: {
              lt: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
            },
          },
          orderBy: { effectiveFrom: "desc" },
        });
        try {
          const policy = await tx[model].create({
            data: {
              schoolId,
              ...input,
              effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
              actorIdentityId: identityId,
              membershipId: actor.membershipId,
            },
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            action,
            operation,
            {
              oldValue: this.evidencePolicyDto(prior),
              newValue: this.evidencePolicyDto(policy),
            },
          );
          return this.evidencePolicyDto(policy);
        } catch (error) {
          if (this.unique(error))
            throw new BadRequestException({
              code: "VALIDATION_ERROR",
              message: "Dữ liệu không hợp lệ.",
              fieldErrors: {
                effectiveFrom: "Đã có phiên bản tại ngày hiệu lực này.",
              },
            });
          throw error;
        }
      },
    );
  }
  async createDailyJournalPolicy(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const input = {
      effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom"),
      ...dailyJournalPolicyFacts,
      reason: this.text(body?.reason, "reason", true, 500)!,
    };
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.dailyJournalPolicy,
      key,
      operationId,
      input,
      async (tx, operation) => {
        const prior = await tx.dailyJournalPolicy.findFirst({
          where: {
            schoolId,
            effectiveFrom: {
              lt: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
            },
          },
          orderBy: { effectiveFrom: "desc" },
        });
        try {
          const policy = await tx.dailyJournalPolicy.create({
            data: {
              schoolId,
              ...input,
              effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
              actorIdentityId: identityId,
              membershipId: actor.membershipId,
            },
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "DAILY_JOURNAL_POLICY_VERSION_CREATED",
            operation,
            {
              oldValue: this.dailyJournalPolicyDto(prior),
              newValue: this.dailyJournalPolicyDto(policy),
            },
          );
          return this.dailyJournalPolicyDto(policy);
        } catch (error) {
          if (this.unique(error))
            throw new BadRequestException({
              code: "VALIDATION_ERROR",
              message: "Dữ liệu không hợp lệ.",
              fieldErrors: {
                effectiveFrom: "Đã có phiên bản tại ngày hiệu lực này.",
              },
            });
          throw error;
        }
      },
    );
  }
  async createLeavePolicy(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const nextDayDeadlineLocalTime =
      typeof body?.nextDayDeadlineLocalTime === "string"
        ? body.nextDayDeadlineLocalTime
        : "";
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(nextDayDeadlineLocalTime))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          nextDayDeadlineLocalTime: "Thời hạn phải theo định dạng HH:mm.",
        },
      });
    const input = {
      effectiveFrom: this.date(body?.effectiveFrom, "effectiveFrom"),
      nextDayDeadlineLocalTime,
    };
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.leavePolicy,
      key,
      operationId,
      input,
      async (tx, operation) => {
        try {
          const policy = await tx.leavePolicy.create({
            data: {
              schoolId,
              effectiveFrom: new Date(`${input.effectiveFrom}T00:00:00.000Z`),
              nextDayDeadlineLocalTime,
              actorIdentityId: identityId,
              membershipId: actor.membershipId,
            },
          });
          await this.audit(
            tx,
            schoolId,
            identityId,
            actor.membershipId,
            "LEAVE_POLICY_VERSION_CREATED",
            operation,
            { newValue: this.leavePolicyDto(policy) },
          );
          return this.leavePolicyDto(policy);
        } catch (error) {
          if (this.unique(error))
            throw new BadRequestException({
              code: "VALIDATION_ERROR",
              message: "Dữ liệu không hợp lệ.",
              fieldErrors: {
                effectiveFrom: "Đã có phiên bản tại ngày hiệu lực này.",
              },
            });
          throw error;
        }
      },
    );
  }
  async createBankAccount(
    identityId: string,
    schoolId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    const input = {
      receivingBank: this.text(body?.receivingBank, "receivingBank")!,
      accountNumber: this.text(
        body?.accountNumber,
        "accountNumber",
        true,
        100,
      )!,
      accountHolderName: this.text(
        body?.accountHolderName,
        "accountHolderName",
      )!,
      transferTemplate: body?.transferTemplate,
    };
    if (input.transferTemplate !== transferTemplate)
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: {
          transferTemplate:
            "Mẫu chuyển khoản phải là {{studentName}} {{className}}.",
        },
      });
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.bankAccount,
      key,
      operationId,
      input,
      async (tx, operation) => {
        const account = await tx.bankAccount.create({
          data: {
            schoolId,
            ...input,
            actorIdentityId: identityId,
            membershipId: actor.membershipId,
          },
        });
        const transition = await tx.bankAccountLifecycleTransition.create({
          data: {
            schoolId,
            bankAccountId: account.id,
            status: "ACTIVE",
            actorIdentityId: identityId,
            membershipId: actor.membershipId,
            operationId: operation,
            sequence: 1,
          },
        });
        const outcome = this.bankAccountDto({
          ...account,
          lifecycleTransitions: [transition],
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "BANK_ACCOUNT_CREATED",
          operation,
          { oldValue: null, newValue: outcome },
        );
        return outcome;
      },
    );
  }
  async transitionBankAccount(
    identityId: string,
    schoolId: string,
    bankAccountId: string,
    key: string,
    operationId: string,
    body: any,
  ) {
    const actor = await this.actor(identityId, schoolId);
    if (!uuid.test(bankAccountId))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { bankAccountId: "ID không hợp lệ." },
      });
    const status = body?.status;
    const reason = this.text(body?.reason, "reason", true, 500)!;
    if (!["ACTIVE", "INACTIVE"].includes(status))
      throw new BadRequestException({
        code: "VALIDATION_ERROR",
        message: "Dữ liệu không hợp lệ.",
        fieldErrors: { status: "Trạng thái không hợp lệ." },
      });
    return this.mutate(
      actor,
      identityId,
      schoolId,
      routes.bankAccountLifecycle,
      key,
      operationId,
      { bankAccountId, status, reason },
      async (tx, operation) => {
        const account = await tx.bankAccount.findFirst({
          where: { id: bankAccountId, schoolId },
          include: {
            lifecycleTransitions: { orderBy: { sequence: "desc" }, take: 1 },
          },
        });
        if (!account)
          throw new ForbiddenException({
            code: "CAPABILITY_DENIED",
            message: "Bạn không có quyền thực hiện thao tác này.",
          });
        const previous = account.lifecycleTransitions[0];
        const previousStatus = previous?.status;
        if (!previousStatus || previousStatus === status)
          throw new BadRequestException({
            code: "VALIDATION_ERROR",
            message: "Dữ liệu không hợp lệ.",
            fieldErrors: { status: "Tài khoản đã ở trạng thái này." },
          });
        const transition = await tx.bankAccountLifecycleTransition.create({
          data: {
            schoolId,
            bankAccountId,
            previousStatus,
            status,
            reason,
            actorIdentityId: identityId,
            membershipId: actor.membershipId,
            operationId: operation,
            sequence: previous.sequence + 1,
          },
        });
        const oldValue = this.bankAccountDto(account);
        const newValue = this.bankAccountDto({
          ...account,
          lifecycleTransitions: [transition, ...account.lifecycleTransitions],
        });
        await this.audit(
          tx,
          schoolId,
          identityId,
          actor.membershipId,
          "BANK_ACCOUNT_LIFECYCLE_CHANGED",
          operation,
          { oldValue, newValue },
        );
        return newValue;
      },
    );
  }
  private unique(error: unknown) {
    return Boolean(
      error &&
        typeof error === "object" &&
        (error as { code?: string }).code === "P2002",
    );
  }
  private async audit(
    tx: any,
    schoolId: string,
    identityId: string,
    membershipId: string,
    action: string,
    operationId: string,
    provenance: object,
  ) {
    await tx.auditRecord.create({
      data: auditData(
        schoolId,
        {
          identityId,
          type: "SCHOOL_MEMBERSHIP",
          reference: membershipId,
          membershipId,
        },
        action,
        { operationId, ...provenance },
      ),
    });
  }
  private async mutate(
    actor: { membershipId: string },
    identityId: string,
    schoolId: string,
    route: string,
    key: string,
    operationId: string,
    body: unknown,
    work: (tx: any, operationId: string) => Promise<unknown>,
  ) {
    if (!uuid.test(key) || !uuid.test(operationId))
      throw new UnauthorizedException({
        code: "IDEMPOTENCY_KEY_REQUIRED",
        message: "Cần Idempotency-Key và X-Operation-Id UUID.",
      });
    const fingerprint = requestFingerprint(body);
    const existing = await this.prisma.operation.findFirst({
      where: {
        schoolId,
        actorReference: actor.membershipId,
        actorType: "SCHOOL_MEMBERSHIP",
        route,
        idempotencyKey: key,
      },
    });
    if (existing) {
      if (existing.fingerprint !== fingerprint)
        throw new ConflictException({
          code: "IDEMPOTENCY_CONFLICT",
          message: "Idempotency-Key đã dùng cho yêu cầu khác.",
        });
      await this.actor(identityId, schoolId);
      return {
        id: existing.id,
        status: existing.status,
        outcome: existing.outcome,
      };
    }
    try {
      return await this.prisma.$transaction(async (tx) => {
        await tx.$queryRaw`SELECT 1 FROM "School" WHERE "id" = ${schoolId}::uuid FOR UPDATE`;
        const membership = await tx.schoolMembership.findFirst({
          where: {
            id: actor.membershipId,
            schoolId,
            userIdentityId: identityId,
            status: "ACTIVE",
            school: { status: "ACTIVE" },
            boundStaffProfile: { employmentStatus: "ACTIVE", primaryPosition: { status: "ACTIVE", grants: { some: { capability: "SETTINGS_MANAGE" } } } },
          },
        });
        if (!membership)
          throw new ForbiddenException({
            code: "CAPABILITY_DENIED",
            message: "Bạn không có quyền thực hiện thao tác này.",
          });
        const operation = await tx.operation.create({
          data: {
            id: operationId,
            schoolId,
            membershipId: actor.membershipId,
            actorIdentityId: identityId,
            actorType: "SCHOOL_MEMBERSHIP",
            actorReference: actor.membershipId,
            route,
            idempotencyKey: key,
            fingerprint,
          },
        });
        const outcome = await work(tx, operation.id);
        const completed = await tx.operation.update({
          where: { id: operation.id },
          data: { status: "COMPLETED", outcome: outcome as any },
        });
        return {
          id: completed.id,
          status: completed.status,
          outcome: completed.outcome,
        };
      });
    } catch (error) {
      if (isOperationIdempotencyCollision(error)) {
        const replay = await this.prisma.operation.findFirst({
          where: {
            schoolId,
            actorReference: actor.membershipId,
            actorType: "SCHOOL_MEMBERSHIP",
            route,
            idempotencyKey: key,
          },
        });
        if (replay && replay.fingerprint === fingerprint) {
          await this.actor(identityId, schoolId);
          return {
            id: replay.id,
            status: replay.status,
            outcome: replay.outcome,
          };
        }
      }
      throw error;
    }
  }
}
