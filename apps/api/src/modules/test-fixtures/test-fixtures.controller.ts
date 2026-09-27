import { Body, Controller, ForbiddenException, Headers, Post } from '@nestjs/common';
import { PrismaService } from '../identity/prisma.service.js';

const fixtureKey = 'parent-release-gate-fixture-key';

@Controller('api/test-fixtures')
export class TestFixturesController {
  constructor(private readonly prisma: PrismaService) {}

  @Post('release-gate/revoke-parent-link')
  async revokeParentLink(
    @Headers('x-test-fixture-key') key: string | undefined,
    @Body() body: { schoolSlug?: string },
  ) {
    if (process.env.NODE_ENV !== 'test' || key !== fixtureKey)
      throw new ForbiddenException();
    if (body.schoolSlug !== 'release-gate-a') throw new ForbiddenException();
    const link = await this.prisma.studentParent.findFirstOrThrow({
      where: {
        status: 'ACTIVE',
        school: { slug: body.schoolSlug },
        parentProfile: { emailNormalized: 'release-gate-parent@example.com' },
      },
      select: { id: true },
    });
    await this.prisma.studentParent.update({
      where: { id: link.id },
      data: { status: 'REVOKED', revokedAt: new Date() },
    });
    return { data: { id: link.id, status: 'REVOKED' } };
  }

  @Post('release-gate/restore-parent-link')
  async restoreParentLink(
    @Headers('x-test-fixture-key') key: string | undefined,
    @Body() body: { schoolSlug?: string },
  ) {
    if (process.env.NODE_ENV !== 'test' || key !== fixtureKey)
      throw new ForbiddenException();
    if (body.schoolSlug !== 'release-gate-a') throw new ForbiddenException();
    const link = await this.prisma.studentParent.findFirstOrThrow({
      where: {
        status: 'REVOKED',
        school: { slug: body.schoolSlug },
        parentProfile: { emailNormalized: 'release-gate-parent@example.com' },
      },
      select: { id: true },
    });
    await this.prisma.studentParent.update({
      where: { id: link.id },
      data: { status: 'ACTIVE', revokedAt: null },
    });
    return { data: { id: link.id, status: 'ACTIVE' } };
  }
}
