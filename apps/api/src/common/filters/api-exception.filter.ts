import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof detail === 'object' && detail && 'message' in detail ? (Array.isArray(detail.message) ? 'Validation failed.' : String(detail.message)) : status === 500 ? 'Internal server error.' : 'Request failed.';
    const fieldErrors = typeof detail === 'object' && detail && 'message' in detail && Array.isArray(detail.message) ? detail.message : undefined;
    response.status(status).json({ error: { code: HttpStatus[status], message, ...(fieldErrors ? { fieldErrors } : {}) } });
  }
}
