import {
  Body, Controller, Get, HttpCode, Post, Req, Res, UnauthorizedException, UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { Request, Response } from 'express';
import type { Session } from '@supabase/supabase-js';
import { AuthService } from './auth.service';
import { SupabaseAuthGuard } from '../../common/guard/supabase-auth.guard';
import {
  AuthResponseDto, EmailDto, LoginDto, MessageResponseDto, OAuthCallbackDto,
  RegisterDto, ResetPasswordDto, VerifyCodeDto,
} from './dto';

const REFRESH_COOKIE = 'refresh_token';

@ApiTags('Auth')
@Controller({ path: 'auth', version: '1' })
@Throttle({ default: { limit: 5, ttl: 60_000 } })
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Post('register')
  @ApiOperation({ summary: 'Register with email and password; sends a verification code' })
  @ApiOkResponse({ type: MessageResponseDto })
  register(@Body() dto: RegisterDto) { return this.auth.register(dto); }

  @Post('verify-email') @HttpCode(200)
  @ApiOperation({ summary: 'Verify the emailed code and start a session' })
  @ApiOkResponse({ type: AuthResponseDto })
  async verify(@Body() dto: VerifyCodeDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.verifyEmail(dto));
  }

  @Post('resend-code') @HttpCode(200)
  resend(@Body() dto: EmailDto) { return this.auth.resendCode(dto.email); }

  @Post('login') @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  @ApiUnauthorizedResponse({ description: 'Invalid credentials or unverified email' })
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    return this.respond(res, await this.auth.login(dto));
  }

  @Post('forgot-password') @HttpCode(200)
  forgot(@Body() dto: EmailDto) { return this.auth.forgotPassword(dto.email); }

  @Post('reset-password') @HttpCode(200)
  reset(@Body() dto: ResetPasswordDto) { return this.auth.resetPassword(dto); }

  @Post('refresh') @HttpCode(200)
  @ApiOkResponse({ type: AuthResponseDto })
  async refresh(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
    const token = req.cookies?.[REFRESH_COOKIE];
    if (!token) throw new UnauthorizedException();
    return this.respond(res, await this.auth.refresh(token));
  }

  @Post('oauth/callback') @HttpCode(200)
  @ApiOperation({ summary: 'Finish Google sign-in: exchange the Supabase session for a backend session' })
  async oauthCallback(@Body() dto: OAuthCallbackDto, @Res({ passthrough: true }) res: Response) {
    const { session, profile } = await this.auth.oauthCallback(dto);
    return { ...this.respond(res, session), profile };
  }

  @Get('me')
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get the current user profile' })
  me(@Req() req: any) { return this.auth.me(req.user.id); }

  @Post('logout') @HttpCode(200)
  @UseGuards(SupabaseAuthGuard)
  @ApiBearerAuth()
  async logout(@Req() req: any, @Res({ passthrough: true }) res: Response) {
    await this.auth.logout(req.accessToken);
    res.clearCookie(REFRESH_COOKIE);
    return { message: 'Logged out' };
  }

  private respond(res: Response, s: Session) {
    res.cookie(REFRESH_COOKIE, s.refresh_token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 30 * 24 * 3600 * 1000,
    });
    return { accessToken: s.access_token, expiresAt: s.expires_at, user: { id: s.user.id, email: s.user.email } };
  }
}