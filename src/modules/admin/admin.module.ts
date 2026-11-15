import { Module } from '@nestjs/common';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';
import { StaffService } from './staff.service';
@Module({ controllers: [AdminController], providers: [AdminService, StaffService] })
export class AdminModule {}
