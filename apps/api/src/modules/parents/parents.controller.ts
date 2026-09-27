import { Body, Controller, Get, Headers, Param, Patch, Req, Res } from "@nestjs/common";
import { audienceConfig } from "../auth/auth.config.js";
import { AuthService } from "../auth/auth.service.js";
import { assertCookieMutation } from "../common/mutation-protection.js";
import { ParentsService } from "./parents.service.js";

type RequestLike = { headers: Record<string, string | undefined> };
type ResponseLike = { setHeader(name: string, value: string): void };
const cookie = (request: RequestLike, name: string) => request.headers.cookie?.split(";").map((item) => item.trim().split("=")).find(([key]) => key === name)?.[1];

@Controller("api/parent/schools/:schoolId")
export class ParentsController {
  constructor(private readonly auth: AuthService, private readonly parents: ParentsService) {}
  private identity(request: RequestLike) {
    return this.auth.session("parent", cookie(request, audienceConfig("parent").cookieName)).userIdentityId;
  }
  @Get("profile")
  async profile(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Res({ passthrough: true }) response?: ResponseLike) {
    response?.setHeader("Cache-Control", "private, no-store");
    return { data: await this.parents.parentPhone(this.identity(request), schoolId) };
  }
  @Patch("profile/phone")
  async phone(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Headers("idempotency-key") key: string, @Headers("x-operation-id") operationId: string, @Body() body: unknown, @Res({ passthrough: true }) response?: ResponseLike) {
    response?.setHeader("Cache-Control", "private, no-store");
    const config = audienceConfig("parent");
    const csrfKey = assertCookieMutation(request, config.origin, config.csrfCookieName, key);
    return { data: await this.parents.updateParentPhone(this.identity(request), schoolId, csrfKey, operationId ?? "", body) };
  }
  @Get("obligations")
  async obligations(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Res({ passthrough: true }) response?: ResponseLike) {
    response?.setHeader("Cache-Control", "private, no-store");
    return { data: await this.parents.obligations(this.identity(request), schoolId) };
  }
  @Get("obligations/:invoiceId")
  async obligation(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Param("invoiceId") invoiceId: string, @Res({ passthrough: true }) response?: ResponseLike) {
    response?.setHeader("Cache-Control", "private, no-store");
    return { data: await this.parents.obligations(this.identity(request), schoolId, invoiceId) };
  }
}
