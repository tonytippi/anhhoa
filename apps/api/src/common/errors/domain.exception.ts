import { HttpException, HttpStatus } from '@nestjs/common';

export const CLASS_HAS_ACTIVE_STUDENTS = 'CLASS_HAS_ACTIVE_STUDENTS';
export const CLASS_ARCHIVED = 'CLASS_ARCHIVED';
export const CLASS_NOT_FOUND = 'CLASS_NOT_FOUND';
export const IDEMPOTENCY_CONFLICT = 'IDEMPOTENCY_CONFLICT';
export const CLASS_TRANSFER_INVALID = 'CLASS_TRANSFER_INVALID';

export class DomainException extends HttpException {
  constructor(code: typeof CLASS_HAS_ACTIVE_STUDENTS | typeof CLASS_ARCHIVED | typeof CLASS_NOT_FOUND | typeof IDEMPOTENCY_CONFLICT | typeof CLASS_TRANSFER_INVALID, message: string, metadata?: { activeStudentCount: number }, fieldErrors?: string[]) {
    if (code === CLASS_HAS_ACTIVE_STUDENTS && (!metadata || !Number.isSafeInteger(metadata.activeStudentCount) || metadata.activeStudentCount < 1)) throw new Error('Domain metadata must contain a positive safe active student count.');
    super({ code, message, ...(metadata ? { metadata } : {}), ...(fieldErrors ? { fieldErrors } : {}) }, HttpStatus.CONFLICT);
  }
}
