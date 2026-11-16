import { MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { AkubinHttpLoggingMiddleware } from './middleware/akubin-http-logging.middleware';
import { ThrottlerModule } from '@nestjs/throttler';
import { SupabaseService } from '../../integrations/supabase/supabase.service';
import { SupabaseAuthGuard } from '../../common/guard/supabase-auth.guard';
import { AkubinController } from './controllers/akubin.controller';
import { AkubinAccountController } from './controllers/akubin-account.controller';
import { AkubinAdminController } from './controllers/akubin-admin.controller';
import { AkubinTelemetryController } from './controllers/akubin-telemetry.controller';
import { AkubinStaffGuard } from './guards/akubin-staff.guard';
import { AkubinDatabase } from './services/akubin-database.service';
import { AkubinConfig } from './services/akubin-config.service';
import { AkubinPinService } from './services/akubin-pin.service';
import { AkubinHardwareService } from './services/akubin-hardware.service';
import { AkubinReadService } from './services/akubin-read.service';
import { AkubinRewardsService } from './services/akubin-rewards.service';
import { AkubinAdminService } from './services/akubin-admin.service';

@Module({
  imports: [
    ThrottlerModule.forRoot([{ name: 'default', ttl: 60000, limit: 120 }]),
  ],
  controllers: [
    AkubinController,
    AkubinAccountController,
    AkubinAdminController,
    AkubinTelemetryController,
  ],
  providers: [
    SupabaseService,
    SupabaseAuthGuard,
    AkubinStaffGuard,
    AkubinDatabase,
    AkubinConfig,
    AkubinPinService,
    AkubinHardwareService,
    AkubinReadService,
    AkubinRewardsService,
    AkubinAdminService,
  ],
})
export class AkubinModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    consumer
      .apply(AkubinHttpLoggingMiddleware)
      .forRoutes(
        AkubinController,
        AkubinAccountController,
        AkubinAdminController,
        AkubinTelemetryController,
      );
  }
}
