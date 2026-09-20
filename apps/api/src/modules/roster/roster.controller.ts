import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  Post,
  Query,
  Req,
} from "@nestjs/common";
import { audienceConfig } from "../auth/auth.config.js";
import { AuthService } from "../auth/auth.service.js";
import { assertCookieMutation } from "../common/mutation-protection.js";
import { RosterService } from "./roster.service.js";
import { ParentsService } from "../parents/parents.service.js";

type RequestLike = { headers: Record<string, string | undefined> };
const cookie = (request: RequestLike, name: string) =>
  request.headers.cookie
    ?.split(";")
    .map((item) => item.trim().split("="))
    .find(([key]) => key === name)?.[1];

@Controller("api/app/schools/:schoolId/roster")
export class RosterController {
  constructor(
    private readonly auth: AuthService,
    private readonly roster: RosterService,
    private readonly parents?: ParentsService,
  ) {}
  private identity(request: RequestLike) {
    return this.auth.session(
      "app",
      cookie(request, audienceConfig("app").cookieName),
    ).userIdentityId;
  }
  private mutation(request: RequestLike, key?: string) {
    const config = audienceConfig("app");
    return assertCookieMutation(
      request,
      config.origin,
      config.csrfCookieName,
      key,
    );
  }
  @Get("school-years") async schoolYears(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
  ) {
    return {
      data: await this.roster.schoolYears(this.identity(request), schoolId),
      meta: {},
    };
  }
  @Post("school-years") async createSchoolYear(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.createSchoolYear(
        this.identity(request),
        schoolId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Get("school-years/:schoolYearId/classes") async classes(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("schoolYearId") schoolYearId: string,
  ) {
    return {
      data: await this.roster.classes(
        this.identity(request),
        schoolId,
        schoolYearId,
      ),
      meta: {},
    };
  }
  @Post("school-years/:schoolYearId/classes") async createClass(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("schoolYearId") schoolYearId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.createClass(
        this.identity(request),
        schoolId,
        schoolYearId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("classes/:classId/name") async renameClass(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("classId") classId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.renameClass(
        this.identity(request),
        schoolId,
        classId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("classes/:classId/archive") async archiveClass(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("classId") classId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
  ) {
    return {
      data: await this.roster.archiveClass(
        this.identity(request),
        schoolId,
        classId,
        this.mutation(request, key),
        operationId ?? "",
      ),
    };
  }
  @Get("school-years/:schoolYearId/students") async students(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("schoolYearId") schoolYearId: string,
    @Query("classId") classId?: string,
  ) {
    return {
      data: await this.roster.students(
        this.identity(request),
        schoolId,
        schoolYearId,
        classId,
      ),
      meta: {},
    };
  }
  @Get("students/:studentId") async student(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
  ) {
    return {
      data: await this.roster.student(
        this.identity(request),
        schoolId,
        studentId,
      ),
    };
  }
  @Get("staff") async staff(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
  ) {
    return {
      data: await this.roster.staff(this.identity(request), schoolId),
      meta: {},
    };
  }
  @Get("positions") async positions(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
  ) {
    return {
      data: await this.roster.positions(this.identity(request), schoolId),
      meta: {},
    };
  }
  @Get("school-years/:schoolYearId/staff-assignments") async assignments(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("schoolYearId") schoolYearId: string,
  ) {
    return {
      data: await this.roster.assignments(
        this.identity(request),
        schoolId,
        schoolYearId,
      ),
      meta: {},
    };
  }
  @Get("students/:studentId/parents") async links(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
  ) {
    return {
      data: await this.parents!.links(
        this.identity(request),
        schoolId,
        studentId,
      ),
    };
  }
  @Post("students/:studentId/parents") async createParent(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.parents!.create(
        this.identity(request),
        schoolId,
        studentId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("student-parents/:linkId/revoke") async revokeParent(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("linkId") linkId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
  ) {
    return {
      data: await this.parents!.revoke(
        this.identity(request),
        schoolId,
        linkId,
        this.mutation(request, key),
        operationId ?? "",
      ),
    };
  }
  @Post("students") async createStudent(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.createStudent(
        this.identity(request),
        schoolId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("enrollments/:enrollmentId/lifecycle") async lifecycle(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("enrollmentId") enrollmentId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.changeLifecycle(
        this.identity(request),
        schoolId,
        enrollmentId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("staff") async createStaff(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.createStaff(
        this.identity(request),
        schoolId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("positions") async createPosition(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.createPosition(
        this.identity(request),
        schoolId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("positions/:positionId/name") async renamePosition(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("positionId") positionId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.renamePosition(
        this.identity(request),
        schoolId,
        positionId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("positions/:positionId/inactivate") async inactivatePosition(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("positionId") positionId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.inactivatePosition(
        this.identity(request),
        schoolId,
        positionId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("positions/:positionId/grants") async grantPositionCapability(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("positionId") positionId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.grantPositionCapability(
        this.identity(request),
        schoolId,
        positionId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("positions/:positionId/grants/:capability/revoke")
  async revokePositionCapability(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("positionId") positionId: string,
    @Param("capability") capability: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.revokePositionCapability(
        this.identity(request),
        schoolId,
        positionId,
        capability,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("staff/:staffId") async updateStaff(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("staffId") staffId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.updateStaff(
        this.identity(request),
        schoolId,
        staffId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("staff/:staffId/assignments") async createAssignment(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("staffId") staffId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.createAssignment(
        this.identity(request),
        schoolId,
        staffId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("staff-assignments/:assignmentId/change") async changeAssignment(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("assignmentId") assignmentId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.changeAssignment(
        this.identity(request),
        schoolId,
        assignmentId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("staff-assignments/:assignmentId/end") async endAssignment(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("assignmentId") assignmentId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.endAssignment(
        this.identity(request),
        schoolId,
        assignmentId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("transitions/preview") async previewTransition(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Body() body: unknown,
  ) {
    this.mutation(request);
    return {
      data: await this.roster.previewTransition(
        this.identity(request),
        schoolId,
        body,
      ),
    };
  }
  @Post("close-year/preview") async previewCloseYear(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Body() body: unknown,
  ) {
    this.mutation(request);
    return {
      data: await this.roster.previewCloseYear(
        this.identity(request),
        schoolId,
        body,
      ),
    };
  }
  @Post("transitions") async transition(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.transitionEnrollments(
        this.identity(request),
        schoolId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("close-year") async closeYear(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.roster.closeYear(
        this.identity(request),
        schoolId,
        this.mutation(request, key),
        operationId ?? "",
        body,
      ),
    };
  }
}

@Controller("api/app/schools/:schoolId/operations")
export class AppOperationController {
  constructor(
    private readonly auth: AuthService,
    private readonly roster: RosterService,
  ) {}
  @Get(":operationId") async operation(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("operationId") operationId: string,
  ) {
    return {
      data: await this.roster.operation(
        this.auth.session(
          "app",
          cookie(request, audienceConfig("app").cookieName),
        ).userIdentityId,
        schoolId,
        operationId,
      ),
    };
  }
}
