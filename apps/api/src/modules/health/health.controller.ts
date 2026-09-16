import { Controller, Get } from '@nestjs/common';

@Controller('health')
export class HealthController {
  @Get()
  check(): { data: { status: string } } {
    return { data: { status: 'ok' } };
  }
}
