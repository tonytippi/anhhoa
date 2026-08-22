import { Module } from '@nestjs/common';
import { ParentAuthModule } from '../parent-auth/parent-auth.module.js';
import { ParentSessionGuard } from '../parent-auth/parent-session.guard.js';
import { ParentPortalController } from './parent-portal.controller.js';
import { ParentPortalService } from './parent-portal.service.js';

@Module({ imports: [ParentAuthModule], controllers: [ParentPortalController], providers: [ParentPortalService, ParentSessionGuard] })
export class ParentPortalModule {}
