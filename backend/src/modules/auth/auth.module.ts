import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';
import { EmailModule } from '../../infrastructure/email/email.module';
import { AuthController } from './auth.controller';
import { AuthGuard } from './auth.guard';
import { AuthAccountThrottleGuard } from './auth-account-throttle.guard';
import { AuthService } from './auth.service';
import { AccountActionTokenService } from './account-action-token.service';
import { VerifiedEmailGuard } from './verified-email.guard';
import { RefreshCookieService } from './sessions/refresh-cookie.service';
import { SessionService } from './sessions/session.service';

@Module({
  imports: [
    EmailModule,
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        secret: configService.getOrThrow<string>('JWT_SECRET'),
        signOptions: {
          expiresIn:
            configService.getOrThrow<number>('JWT_ACCESS_TTL_MINUTES') * 60,
        },
      }),
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    AccountActionTokenService,
    VerifiedEmailGuard,
    AuthGuard,
    AuthAccountThrottleGuard,
    SessionService,
    RefreshCookieService,
  ],
  exports: [AuthGuard, VerifiedEmailGuard, JwtModule],
})
export class AuthModule {}
