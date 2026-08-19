import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { CLASS_ARCHIVED, CLASS_HAS_ACTIVE_STUDENTS, CLASS_NOT_FOUND } from '../errors/domain.exception.js';

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof HttpException ? exception.getResponse() : undefined;
    const message = typeof detail === 'object' && detail && 'message' in detail ? (Array.isArray(detail.message) ? 'Validation failed.' : String(detail.message)) : status === 500 ? 'Internal server error.' : 'Request failed.';
    const fieldErrors = typeof detail === 'object' && detail && 'fieldErrors' in detail && Array.isArray(detail.fieldErrors) ? detail.fieldErrors as string[] : typeof detail === 'object' && detail && 'message' in detail && Array.isArray(detail.message) ? detail.message as string[] : undefined;
    const isActiveStudentError = typeof detail === 'object' && detail && 'code' in detail && detail.code === CLASS_HAS_ACTIVE_STUDENTS && 'metadata' in detail && detail.metadata && typeof detail.metadata === 'object' && 'activeStudentCount' in detail.metadata && typeof detail.metadata.activeStudentCount === 'number' && Number.isSafeInteger(detail.metadata.activeStudentCount) && detail.metadata.activeStudentCount > 0;
    const isArchivedError = typeof detail === 'object' && detail && 'code' in detail && detail.code === CLASS_ARCHIVED;
    const isClassNotFoundError = typeof detail === 'object' && detail && 'code' in detail && detail.code === CLASS_NOT_FOUND;
    const isSerializationConflict = typeof exception === 'object' && exception !== null && 'code' in exception && exception.code === 'P2034';
    const code = isActiveStudentError ? CLASS_HAS_ACTIVE_STUDENTS : isArchivedError ? CLASS_ARCHIVED : isClassNotFoundError ? CLASS_NOT_FOUND : isSerializationConflict ? 'CONFLICT' : HttpStatus[status];
    const metadata = isActiveStudentError ? { activeStudentCount: (detail.metadata as { activeStudentCount: number }).activeStudentCount } : undefined;
    response.status(status).json({ error: { code, message, ...(fieldErrors ? { fieldErrors } : {}), ...(metadata ? { metadata } : {}) } });
  }
}
