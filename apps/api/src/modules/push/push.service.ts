import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnApplicationBootstrap, type OnApplicationShutdown } from "@nestjs/common";
import webpush from "web-push";
import { inboxText } from "../common/inbox-text.js";
import { PrismaService } from "../identity/prisma.service.js";

export type PushAudience = "PARENT" | "TEACHER";
type Subscription = { id: string; endpoint: string; p256dh: string; auth: string };
export type PushMessage = { title: string; body: string; url: string; tag: string };
type Transport = (subscription: Subscription, message: PushMessage) => Promise<void>;
type ClaimedEvent = { id: string; schoolId: string; studentId: string; sourceType: string; state: string | null; payload: unknown; studentDisplayNameSnapshot: string | null; createdAt: Date };
type ClaimedMessage = { id: string; schoolId: string; studentId: string; senderLabel: string; createdAt: Date };

// Push services browsers actually use; any other endpoint is refused so the API never calls arbitrary URLs.
const pushHosts = [/^fcm\.googleapis\.com$/, /^android\.googleapis\.com$/, /(^|\.)push\.apple\.com$/, /(^|\.)push\.services\.mozilla\.com$/, /(^|\.)notify\.windows\.com$/];
const staleAfterMs = 6 * 60 * 60 * 1000;
const intervalMs = 5000;
const batch = 100;

export function pushConfig() {
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim() ?? "";
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim() ?? "";
  const subject = process.env.VAPID_SUBJECT?.trim() || "mailto:support@passionedu.org";
  return { enabled: Boolean(publicKey && privateKey), publicKey, privateKey, subject };
}

@Injectable()
export class PushService implements OnApplicationBootstrap, OnApplicationShutdown {
  private readonly logger = new Logger(PushService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  transport: Transport = async (subscription, message) => {
    const config = pushConfig();
    await webpush.sendNotification(
      { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
      JSON.stringify(message),
      { TTL: 6 * 60 * 60, urgency: "high", topic: message.tag.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 32), vapidDetails: { subject: config.subject, publicKey: config.publicKey, privateKey: config.privateKey } },
    );
  };

  constructor(private readonly prisma: PrismaService) {}

  onApplicationBootstrap() {
    if (!pushConfig().enabled || process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => void this.tick(), intervalMs);
    this.timer.unref();
  }
  onApplicationShutdown() {
    if (this.timer) clearInterval(this.timer);
  }
  private async tick() {
    if (this.running) return;
    this.running = true;
    try {
      await this.dispatch();
    } catch (error) {
      this.logger.warn(`Push dispatch failed: ${(error as Error).message}`);
    } finally {
      this.running = false;
    }
  }

  config() {
    const config = pushConfig();
    return { enabled: config.enabled, publicKey: config.enabled ? config.publicKey : null };
  }
  private async authorize(audience: PushAudience, identityId: string, schoolId: string) {
    if (audience === "PARENT") {
      const parent = await this.prisma.parentProfile.findFirst({ where: { userIdentityId: identityId, studentParents: { some: { schoolId, status: "ACTIVE" } } }, select: { id: true } });
      if (!parent) throw new NotFoundException({ code: "SCHOOL_CONTEXT_DENIED", message: "Không thể truy cập ngữ cảnh trường này." });
      return;
    }
    const membership = await this.prisma.schoolMembership.findFirst({ where: { schoolId, userIdentityId: identityId, status: "ACTIVE", school: { status: "ACTIVE" } }, select: { id: true } });
    if (!membership) throw new ForbiddenException({ code: "CAPABILITY_DENIED", message: "Bạn không có quyền thực hiện thao tác này." });
  }
  private input(body: unknown) {
    const value = body as { endpoint?: unknown; keys?: { p256dh?: unknown; auth?: unknown } } | null;
    const endpoint = typeof value?.endpoint === "string" ? value.endpoint : "";
    const p256dh = typeof value?.keys?.p256dh === "string" ? value.keys.p256dh : "";
    const auth = typeof value?.keys?.auth === "string" ? value.keys.auth : "";
    let host = "";
    try {
      const url = new URL(endpoint);
      if (url.protocol === "https:") host = url.hostname;
    } catch {
      host = "";
    }
    if (!host || !pushHosts.some((pattern) => pattern.test(host)) || endpoint.length > 1024 || !/^[A-Za-z0-9_-]{40,200}$/.test(p256dh) || !/^[A-Za-z0-9_-]{8,64}$/.test(auth))
      throw new BadRequestException({ code: "VALIDATION_ERROR", message: "Đăng ký thông báo không hợp lệ.", fieldErrors: { endpoint: "Đăng ký thông báo không hợp lệ." } });
    return { endpoint, p256dh, auth };
  }
  async subscribe(audience: PushAudience, identityId: string, schoolId: string, body: unknown) {
    if (!pushConfig().enabled) throw new NotFoundException({ code: "PUSH_DISABLED", message: "Hệ thống chưa bật thông báo đẩy." });
    await this.authorize(audience, identityId, schoolId);
    const input = this.input(body);
    // The endpoint belongs to one browser profile: re-subscribing hands it to whoever is signed in now.
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: input.endpoint },
      create: { audience, userIdentityId: identityId, ...input },
      update: { audience, userIdentityId: identityId, p256dh: input.p256dh, auth: input.auth, failureCount: 0 },
    });
    return { subscribed: true };
  }
  async unsubscribe(audience: PushAudience, identityId: string, body: unknown) {
    const endpoint = typeof (body as { endpoint?: unknown } | null)?.endpoint === "string" ? (body as { endpoint: string }).endpoint : "";
    await this.prisma.pushSubscription.deleteMany({ where: { endpoint, audience, userIdentityId: identityId } });
    return { subscribed: false };
  }

  // Outbox dispatch: claim undelivered rows with SKIP LOCKED so several API instances never push twice,
  // then resolve recipients at delivery time so revoked links and ended assignments receive nothing.
  async dispatch(now = new Date()) {
    const events = await this.prisma.$queryRaw<ClaimedEvent[]>`
      UPDATE "NotificationSourceEvent" SET "pushDispatchedAt" = ${now}
      WHERE "id" IN (SELECT "id" FROM "NotificationSourceEvent" WHERE "pushDispatchedAt" IS NULL ORDER BY "createdAt" LIMIT ${batch} FOR UPDATE SKIP LOCKED)
      RETURNING "id", "schoolId", "studentId", "sourceType"::text AS "sourceType", "state"::text AS "state", "payload", "studentDisplayNameSnapshot", "createdAt"`;
    const messages = await this.prisma.$queryRaw<ClaimedMessage[]>`
      UPDATE "StudentMessage" SET "pushDispatchedAt" = ${now}
      WHERE "id" IN (SELECT "id" FROM "StudentMessage" WHERE "pushDispatchedAt" IS NULL AND "senderType" = 'PARENT' ORDER BY "createdAt" LIMIT ${batch} FOR UPDATE SKIP LOCKED)
      RETURNING "id", "schoolId", "studentId", "senderLabel", "createdAt"`;
    let sent = 0;
    for (const event of events) {
      if (now.getTime() - event.createdAt.getTime() > staleAfterMs) continue;
      const identities = await this.parentIdentities(event.schoolId, event.studentId);
      const message: PushMessage = {
        title: event.studentDisplayNameSnapshot ?? "PassionEdu",
        body: inboxText(event),
        url: event.sourceType === "MESSAGE" ? "/messages" : "/inbox",
        tag: event.sourceType === "MESSAGE" ? `message-${event.studentId}` : `event-${event.id}`,
      };
      sent += await this.deliver("PARENT", identities, message);
    }
    for (const item of messages) {
      if (now.getTime() - item.createdAt.getTime() > staleAfterMs) continue;
      const target = await this.teacherIdentities(item.schoolId, item.studentId, now);
      if (!target) continue;
      sent += await this.deliver("TEACHER", target.identities, {
        title: "Tin nhắn phụ huynh",
        body: `${item.senderLabel} của ${target.studentName} gửi tin nhắn mới`,
        url: `/schools/${target.schoolSlug}/messages?student=${item.studentId}`,
        tag: `message-${item.studentId}`,
      });
    }
    return { events: events.length, messages: messages.length, sent };
  }
  private async parentIdentities(schoolId: string, studentId: string) {
    const links = await this.prisma.studentParent.findMany({
      where: { schoolId, studentId, status: "ACTIVE", school: { status: "ACTIVE" }, parentProfile: { userIdentityId: { not: null } } },
      select: { parentProfile: { select: { userIdentityId: true } } },
    });
    return links.map((link) => link.parentProfile.userIdentityId!);
  }
  private async teacherIdentities(schoolId: string, studentId: string, now: Date) {
    const day = new Date(`${new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh" }).format(now)}T00:00:00.000Z`);
    const effective = { effectiveFrom: { lte: day }, OR: [{ effectiveTo: null }, { effectiveTo: { gt: day } }] };
    const placements = await this.prisma.enrollmentClassAssignment.findMany({
      where: { schoolId, ...effective, enrollment: { studentId, lifecycle: "ENROLLED", effectiveFrom: { lte: day }, OR: [{ endedOn: null }, { endedOn: { gt: day } }] } },
      select: { classId: true, enrollment: { select: { student: { select: { fullName: true } } } }, school: { select: { slug: true, status: true } } },
    });
    if (!placements.length || placements[0]!.school.status !== "ACTIVE") return null;
    const assignments = await this.prisma.staffClassAssignment.findMany({
      where: {
        schoolId,
        classId: { in: placements.map((placement) => placement.classId) },
        ...effective,
        staffProfile: {
          employmentStatus: "ACTIVE",
          boundAt: { not: null },
          primaryPosition: { status: "ACTIVE", grants: { some: { capability: "PARENT_MESSAGE_WRITE" } } },
          schoolMembership: { status: "ACTIVE" },
        },
      },
      select: { staffProfile: { select: { schoolMembership: { select: { userIdentityId: true } } } } },
    });
    return {
      schoolSlug: placements[0]!.school.slug,
      studentName: placements[0]!.enrollment.student.fullName,
      identities: [...new Set(assignments.flatMap((assignment) => (assignment.staffProfile.schoolMembership ? [assignment.staffProfile.schoolMembership.userIdentityId] : [])))],
    };
  }
  private async deliver(audience: PushAudience, identities: string[], message: PushMessage) {
    if (!identities.length) return 0;
    const subscriptions = await this.prisma.pushSubscription.findMany({ where: { audience, userIdentityId: { in: identities } } });
    let sent = 0;
    await Promise.all(subscriptions.map(async (subscription) => {
      try {
        await this.transport(subscription, message);
        sent += 1;
        await this.prisma.pushSubscription.update({ where: { id: subscription.id }, data: { lastSuccessAt: new Date(), failureCount: 0 } });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: the browser dropped the subscription; repeated other failures retire it too.
        if (status === 404 || status === 410 || subscription.failureCount >= 9) await this.prisma.pushSubscription.deleteMany({ where: { id: subscription.id } });
        else await this.prisma.pushSubscription.update({ where: { id: subscription.id }, data: { failureCount: { increment: 1 } } });
      }
    }));
    return sent;
  }
}
