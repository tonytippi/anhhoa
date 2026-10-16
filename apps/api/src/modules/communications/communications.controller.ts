import { Body, Controller, Get, Headers, Param, Post, Query, Req, Res } from "@nestjs/common";
import { audienceConfig } from "../auth/auth.config.js";
import { AuthService } from "../auth/auth.service.js";
import { assertCookieMutation } from "../common/mutation-protection.js";
import { CommunicationsService } from "./communications.service.js";

type RequestLike = { headers: Record<string, string | undefined> };
type ResponseLike = { setHeader(name: string, value: string): void; send(value: Uint8Array): void };
const cookie = (request: RequestLike, name: string) =>
  request.headers.cookie
    ?.split(";")
    .map((item) => item.trim().split("="))
    .find(([key]) => key === name)?.[1];

@Controller("api")
export class CommunicationsController {
  constructor(
    private readonly auth: AuthService,
    private readonly communications: CommunicationsService,
  ) {}
  private identity(request: RequestLike, audience: "teacher" | "parent") {
    return this.auth.session(audience, cookie(request, audienceConfig(audience).cookieName)).userIdentityId;
  }
  private mutation(request: RequestLike, audience: "teacher" | "parent", key?: string) {
    const config = audienceConfig(audience);
    return assertCookieMutation(request, config.origin, config.csrfCookieName, key);
  }
  private media(response: ResponseLike, media: { contentType: string; blob: Uint8Array }) {
    response.setHeader("Content-Type", media.contentType);
    response.setHeader("Cache-Control", "private, no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    response.send(media.blob);
  }

  @Get("teacher/schools/:schoolId/classes")
  async teacherClasses(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Query("date") date?: string) {
    return { data: await this.communications.teacherClasses(this.identity(request, "teacher"), schoolId, date) };
  }
  @Get("teacher/schools/:schoolId/class-notes")
  async teacherClassNote(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Query("classId") classId: string,
    @Query("noteDate") noteDate: string,
  ) {
    return { data: await this.communications.teacherClassNote(this.identity(request, "teacher"), schoolId, classId ?? "", noteDate) };
  }
  @Post("teacher/schools/:schoolId/class-note-media")
  async uploadClassNoteMedia(
    @Req() request: RequestLike & { body: unknown },
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Query("classId") classId: string,
    @Query("noteDate") noteDate: string,
  ) {
    return {
      data: await this.communications.uploadClassNoteMedia(
        this.identity(request, "teacher"),
        schoolId,
        this.mutation(request, "teacher", key),
        operationId ?? "",
        classId ?? "",
        noteDate,
        request.headers["content-type"]?.split(";")[0],
        request.body,
      ),
    };
  }
  @Post("teacher/schools/:schoolId/class-notes")
  async saveClassNote(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.communications.saveClassNote(
        this.identity(request, "teacher"),
        schoolId,
        this.mutation(request, "teacher", key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Get("teacher/schools/:schoolId/class-note-media/:mediaId")
  async readTeacherClassNoteMedia(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("mediaId") mediaId: string,
    @Res() response: ResponseLike,
  ) {
    this.media(response, await this.communications.readTeacherClassNoteMedia(this.identity(request, "teacher"), schoolId, mediaId));
  }
  @Get("teacher/schools/:schoolId/message-threads")
  async teacherThreads(@Req() request: RequestLike, @Param("schoolId") schoolId: string, @Query("classId") classId: string) {
    return { data: await this.communications.teacherThreads(this.identity(request, "teacher"), schoolId, classId ?? "") };
  }
  @Get("teacher/schools/:schoolId/students/:studentId/messages")
  async teacherMessages(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Query("classId") classId: string,
  ) {
    return { data: await this.communications.teacherMessages(this.identity(request, "teacher"), schoolId, classId ?? "", studentId) };
  }
  @Post("teacher/schools/:schoolId/students/:studentId/messages")
  async teacherSendMessage(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.communications.teacherSendMessage(
        this.identity(request, "teacher"),
        schoolId,
        studentId,
        this.mutation(request, "teacher", key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("teacher/schools/:schoolId/students/:studentId/messages/read")
  async teacherReadMessages(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Query("classId") classId: string,
  ) {
    this.mutation(request, "teacher");
    return { data: await this.communications.teacherReadMessages(this.identity(request, "teacher"), schoolId, classId ?? "", studentId) };
  }

  @Get("parent/schools/:schoolId/students/:studentId/class-note")
  async parentClassNote(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Query("noteDate") noteDate?: string,
    @Res({ passthrough: true }) response?: ResponseLike,
  ) {
    response?.setHeader("Cache-Control", "private, no-store");
    return { data: await this.communications.parentClassNote(this.identity(request, "parent"), schoolId, studentId, noteDate) };
  }
  @Get("parent/schools/:schoolId/class-note-media/:mediaId")
  async readParentClassNoteMedia(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("mediaId") mediaId: string,
    @Res() response: ResponseLike,
  ) {
    this.media(response, await this.communications.readParentClassNoteMedia(this.identity(request, "parent"), schoolId, mediaId));
  }
  @Get("parent/schools/:schoolId/messages/summary")
  async parentMessageSummary(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Res({ passthrough: true }) response?: ResponseLike,
  ) {
    response?.setHeader("Cache-Control", "private, no-store");
    return { data: await this.communications.parentMessageSummary(this.identity(request, "parent"), schoolId) };
  }
  @Get("parent/schools/:schoolId/students/:studentId/messages")
  async parentMessages(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Res({ passthrough: true }) response?: ResponseLike,
  ) {
    response?.setHeader("Cache-Control", "private, no-store");
    return { data: await this.communications.parentMessages(this.identity(request, "parent"), schoolId, studentId) };
  }
  @Post("parent/schools/:schoolId/students/:studentId/messages")
  async parentSendMessage(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
    @Headers("idempotency-key") key: string,
    @Headers("x-operation-id") operationId: string,
    @Body() body: unknown,
  ) {
    return {
      data: await this.communications.parentSendMessage(
        this.identity(request, "parent"),
        schoolId,
        studentId,
        this.mutation(request, "parent", key),
        operationId ?? "",
        body,
      ),
    };
  }
  @Post("parent/schools/:schoolId/students/:studentId/messages/read")
  async parentReadMessages(
    @Req() request: RequestLike,
    @Param("schoolId") schoolId: string,
    @Param("studentId") studentId: string,
  ) {
    this.mutation(request, "parent");
    return { data: await this.communications.parentReadMessages(this.identity(request, "parent"), schoolId, studentId) };
  }
}
