import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { HealthModule } from './modules/health/health.module';
import { AuthModule } from './modules/auth/auth.module';
import { PrismaModule } from './integrations/database/prisma.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AkubinModule } from './modules/akubin/akubin.module';
import { PlatformModule } from './common/platform/platform.module';
import { UsersModule } from './modules/users/users.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { SupportModule } from './modules/support/support.module';
import { UploadsModule } from './modules/uploads/uploads.module';
import { VerificationModule } from './modules/verification/verification.module';
import { ListingsModule } from './modules/listings/listings.module';
import { OffersModule } from './modules/offers/offers.module';
import { BuyerRequestsModule } from './modules/buyer-requests/buyer-requests.module';
import { OrdersModule } from './modules/orders/orders.module';
import { PartnersModule } from './modules/partners/partners.module';
import { PaymentsModule } from './modules/payments/payments.module';
import { ContentModule } from './modules/content/content.module';
import { AdvertisingModule } from './modules/advertising/advertising.module';
import { RecommendationsModule } from './modules/recommendations/recommendations.module';
import { AssistantModule } from './modules/assistant/assistant.module';
import { AdminModule } from './modules/admin/admin.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    PlatformModule,
    HealthModule,
    AuthModule,
    AkubinModule,
    UsersModule,
    NotificationsModule,
    SupportModule,
    UploadsModule,
    VerificationModule,
    ListingsModule,
    OffersModule,
    BuyerRequestsModule,
    OrdersModule,
    PartnersModule,
    PaymentsModule,
    ContentModule,
    AdvertisingModule,
    RecommendationsModule,
    AssistantModule,
    AdminModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
