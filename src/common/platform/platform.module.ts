import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';
import { SupabaseService } from '../../integrations/supabase/supabase.service';
import { SupabaseAuthGuard } from '../guard/supabase-auth.guard';
import { DatabaseService } from './database.service';
import { PlatformStaffGuard } from './staff.guard';
import { OptionalAuthGuard } from './optional-auth.guard';
import { TradePolicy } from './trade-policy.service';
@Global()
@Module({
  imports: [
    ThrottlerModule.forRoot({
      getTracker: (req) => (req.user?.id ? `account:${req.user.id}` : req.ip),
      throttlers: [{ name: 'default', ttl: 60000, limit: 120 }],
    }),
  ],
  providers: [
    DatabaseService,
    SupabaseService,
    SupabaseAuthGuard,
    PlatformStaffGuard,
    OptionalAuthGuard,
    TradePolicy,
  ],
  exports: [
    DatabaseService,
    SupabaseService,
    SupabaseAuthGuard,
    PlatformStaffGuard,
    OptionalAuthGuard,
    TradePolicy,
    ThrottlerModule,
  ],
})
export class PlatformModule {}
