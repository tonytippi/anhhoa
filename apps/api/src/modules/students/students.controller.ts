import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { StudentStatus } from '@prisma/client';
import { CreateStudentDto, ListStudentsDto, StudentIdDto, UpdateStudentDto } from './students.dto.js';
import { StudentsService } from './students.service.js';

@Controller('students')
export class StudentsController {
  constructor(private readonly students: StudentsService) {}
  @Get() list(@Query() query: ListStudentsDto) { return this.students.list(query); }
  @Get(':id') get(@Param() params: StudentIdDto) { return this.students.get(params.id); }
  @Post() create(@Body() body: CreateStudentDto) { return this.students.create(body); }
  @Patch(':id') update(@Param() params: StudentIdDto, @Body() body: UpdateStudentDto) { return this.students.update(params.id, body); }
  @Post(':id/withdraw') withdraw(@Param() params: StudentIdDto) { return this.students.setStatus(params.id, StudentStatus.INACTIVE); }
  @Post(':id/reactivate') reactivate(@Param() params: StudentIdDto) { return this.students.setStatus(params.id, StudentStatus.ACTIVE); }
}
