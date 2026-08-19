import { Body, Controller, Get, Param, Patch, Post, Query } from '@nestjs/common';
import { ClassesService } from './classes.service.js';
import { ClassIdDto, CreateClassDto, ListClassesDto, UpdateClassDto } from './classes.dto.js';

@Controller('classes')
export class ClassesController {
  constructor(private readonly classes: ClassesService) {}
  @Get() list(@Query() query: ListClassesDto) { return this.classes.list(query); }
  @Get(':id') get(@Param() params: ClassIdDto) { return this.classes.get(params.id); }
  @Post() create(@Body() body: CreateClassDto) { return this.classes.create(body); }
  @Patch(':id') update(@Param() params: ClassIdDto, @Body() body: UpdateClassDto) { return this.classes.update(params.id, body); }
  @Post(':id/archive') archive(@Param() params: ClassIdDto) { return this.classes.archive(params.id); }
}
