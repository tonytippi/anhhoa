import { Body, Controller, ForbiddenException, Get, Param, Post, Req } from "@nestjs/common";
import { audienceConfig } from "../auth/auth.config.js";
import { AuthService } from "../auth/auth.service.js";
import { assertCookieMutation } from "../common/mutation-protection.js";
import { PushService, type PushAudience } from "./push.service.js";

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) =>
  request.headers.cookie
    ?.split(";")
    .map((item) => item.trim().split("="))
    .find(([key]) => key === name)?.[1];
const audiences: Record<string, { session: "parent" | "teacher"; push: PushAudience }> = {
  parent: { session: "parent", push: "PARENT" },
  teacher: { session: "teacher", push: "TEACHER" },
};

// Routes sit under /api/{parent,teacher}/schools/:schoolId so they share the portal CORS and session rules.
@Controller("api")
export class PushController {
  constructor(
    private readonly auth: AuthService,
    private readonly push: PushService,
  ) {}
  private identity(request: RequestLike, audience: "parent" | "teacher") {
    return this.auth.session(audience, cookie(request, audienceConfig(audience).cookieName)).userIdentityId;
  }
  // An impersonating Platform Operator must never route the user's notifications to the operator's device.
  private owner(request: RequestLike, audience: "parent" | "teacher") {
    const session = this.auth.session(audience, cookie(request, audienceConfig(audience).cookieName));
    if (session.impersonation) throw new ForbiddenException({ code: "IMPERSONATION_FORBIDDEN", message: "Không thể bật thông báo khi đang giả lập người dùng." });
    return session.userIdentityId;
  }
  private mutation(request: RequestLike, audience: "parent" | "teacher") {
    const config = audienceConfig(audience);
    assertCookieMutation(request, config.origin, config.csrfCookieName);
  }

  @Get("parent/schools/:schoolId/push/config")
  parentConfig(@Req() request: RequestLike) {
    return this.config(request, "parent");
  }
  @Get("teacher/schools/:schoolId/push/config")
  teacherConfig(@Req() request: RequestLike) {
    return this.config(request, "teacher");
  }
  @Post("parent/schools/:schoolId/push/subscriptions")
  parentSubscribe(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.subscribe(request, "parent", schoolId, body);
  }
  @Post("teacher/schools/:schoolId/push/subscriptions")
  teacherSubscribe(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Body() body: unknown) {
    return this.subscribe(request, "teacher", schoolId, body);
  }
  @Post("parent/schools/:schoolId/push/subscriptions/remove")
  parentUnsubscribe(@Req() request: RequestLike, @Body() body: unknown) {
    return this.unsubscribe(request, "parent", body);
  }
  @Post("teacher/schools/:schoolId/push/subscriptions/remove")
  teacherUnsubscribe(@Req() request: RequestLike, @Body() body: unknown) {
    return this.unsubscribe(request, "teacher", body);
  }

  private config(request: RequestLike, audience: string) {
    const session = this.auth.session(audiences[audience]!.session, cookie(request, audienceConfig(audiences[audience]!.session).cookieName));
    // Impersonated sessions see push as unavailable, so the opt-in never appears for the operator.
    return { data: session.impersonation ? { enabled: false, publicKey: null } : this.push.config() };
  }
  private async subscribe(request: RequestLike, audience: string, schoolId: string, body: unknown) {
    const target = audiences[audience]!;
    this.mutation(request, target.session);
    return { data: await this.push.subscribe(target.push, this.owner(request, target.session), schoolId, body) };
  }
  private async unsubscribe(request: RequestLike, audience: string, body: unknown) {
    const target = audiences[audience]!;
    this.mutation(request, target.session);
    return { data: await this.push.unsubscribe(target.push, this.identity(request, target.session), body) };
  }
}
