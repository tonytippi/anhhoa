import { ConflictException, Injectable } from '@nestjs/common';
import type { Admin } from '@prisma/client';
import { normalizeEmail } from '../../common/config/auth-config.js';
import { PrismaService } from '../../common/prisma/prisma.service.js';

export interface GoogleAdminProfile {
  googleId: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
}

@Injectable()
export class AdminsService {
  constructor(private readonly prisma: PrismaService) {}
  async upsertGoogleAdmin(profile: GoogleAdminProfile): Promise<Admin> {
    const email = normalizeEmail(profile.email);
    const byGoogleId = await this.prisma.admin.findUnique({ where: { googleId: profile.googleId } });
    if (byGoogleId) {
      const byEmail = await this.prisma.admin.findUnique({ where: { email } });
      if (byEmail && byEmail.id !== byGoogleId.id) throw new ConflictException('Unable to link this account.');
      return this.prisma.admin.update({ where: { id: byGoogleId.id }, data: { email, displayName: profile.displayName, avatarUrl: profile.avatarUrl } });
    }
    const byEmail = await this.prisma.admin.findUnique({ where: { email } });
    if (byEmail) throw new ConflictException('Unable to link this account.');
    return this.prisma.admin.create({ data: { email, googleId: profile.googleId, displayName: profile.displayName, avatarUrl: profile.avatarUrl } });
  }
}
