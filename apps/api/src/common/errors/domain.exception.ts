import { HttpException, HttpStatus } from '@nestjs/common';

export const CLASS_HAS_ACTIVE_STUDENTS = 'CLASS_HAS_ACTIVE_STUDENTS';

export class DomainException extends HttpException {
  constructor(code: typeof CLASS_HAS_ACTIVE_STUDENTS, message: string, metadata: { activeStudentCount: number }) {
    if (!Number.isSafeInteger(metadata.activeStudentCount) || metadata.activeStudentCount < 1) throw new Error('Domain metadata must contain a positive safe active student count.');
    super({ code, message, metadata }, HttpStatus.CONFLICT);
  }
}
