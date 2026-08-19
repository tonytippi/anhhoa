import { HttpException, HttpStatus } from '@nestjs/common';

export const CLASS_HAS_ACTIVE_STUDENTS = 'CLASS_HAS_ACTIVE_STUDENTS';
export const CLASS_ARCHIVED = 'CLASS_ARCHIVED';

export class DomainException extends HttpException {
  constructor(code: typeof CLASS_HAS_ACTIVE_STUDENTS | typeof CLASS_ARCHIVED, message: string, metadata?: { activeStudentCount: number }) {
    if (code === CLASS_HAS_ACTIVE_STUDENTS && (!metadata || !Number.isSafeInteger(metadata.activeStudentCount) || metadata.activeStudentCount < 1)) throw new Error('Domain metadata must contain a positive safe active student count.');
    super({ code, message, ...(metadata ? { metadata } : {}) }, HttpStatus.CONFLICT);
  }
}
