import { ArgumentsHost, Catch, HttpException, HttpStatus, Logger } from '@nestjs/common';

@Catch()
export class ApiErrorFilter {
  private readonly logger = new Logger(ApiErrorFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const request = host.switchToHttp().getRequest<{ method?: unknown; originalUrl?: unknown; url?: unknown; headers?: Record<string, unknown> }>();
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    if (!(exception instanceof HttpException)) {
      const rawPath = typeof request.originalUrl === 'string' ? request.originalUrl : request.url;
      let pathname: string | undefined;
      if (typeof rawPath === 'string') {
        try { pathname = new URL(rawPath, 'http://localhost').pathname; } catch { pathname = undefined; }
      }
      const rawStack = exception instanceof Error && typeof exception.stack === 'string' ? exception.stack.split('\n').filter((line) => line.trimStart().startsWith('at ')).join('\n') : undefined;
      const rawCode = exception && typeof exception === 'object' && typeof (exception as { code?: unknown }).code === 'string' ? (exception as { code: string }).code : undefined;
      const errorCode = rawCode && /^P\d{4}$/.test(rawCode) ? rawCode : 'UNHANDLED_EXCEPTION';
      const rawRequestId = request.headers?.['x-request-id'];
      const requestId = typeof rawRequestId === 'string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,127}$/.test(rawRequestId) ? rawRequestId : undefined;
      this.logger.error({ event: 'unhandled_exception', code: errorCode, method: typeof request.method === 'string' ? request.method : undefined, pathname, ...(requestId ? { 'x-request-id': requestId } : {}), message: 'Unhandled non-HTTP exception.', ...(rawStack ? { stack: rawStack } : {}) });
    }
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof detail === 'object' && detail !== null ? detail as { code?: unknown; message?: unknown; fieldErrors?: unknown } : {};
    const message = typeof body.message === 'string' ? body.message : status === HttpStatus.INTERNAL_SERVER_ERROR ? 'Lỗi máy chủ nội bộ.' : 'Yêu cầu không hợp lệ.';
    const code = typeof body.code === 'string' ? body.code : status === HttpStatus.UNAUTHORIZED ? 'AUTHENTICATION_REQUIRED' : 'INTERNAL_SERVER_ERROR';
    const fieldErrors = body.fieldErrors && typeof body.fieldErrors === 'object' && !Array.isArray(body.fieldErrors) ? body.fieldErrors : undefined;
    response.status(status).json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}) } });
  }
}
