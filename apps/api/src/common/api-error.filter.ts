import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';

@Catch()
export class ApiErrorFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<{ status(code: number): { json(body: unknown): void } }>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;
    const body = typeof detail === 'object' && detail !== null ? detail as { code?: unknown; message?: unknown } : {};
    const message = typeof body.message === 'string' ? body.message : exception instanceof Error ? exception.message : 'Lỗi máy chủ nội bộ.';
    const code = typeof body.code === 'string' ? body.code : status === HttpStatus.UNAUTHORIZED ? 'AUTHENTICATION_REQUIRED' : 'INTERNAL_SERVER_ERROR';
    response.status(status).json({ error: { code, message } });
  }
}
