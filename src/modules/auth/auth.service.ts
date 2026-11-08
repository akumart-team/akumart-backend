import { BadRequestException, Injectable, UnauthorizedException,  NotFoundException, } from '@nestjs/common';
import { SupabaseService } from '../../integrations/supabase/supabase.service';
import { RegisterDto, VerifyCodeDto, LoginDto, ResetPasswordDto, OAuthCallbackDto } from './dto';
import { PrismaService } from '../../integrations/database/prisma.service';


@Injectable()
export class AuthService {
 constructor(private supabase: SupabaseService, private prisma: PrismaService) {}

  async register(dto: RegisterDto) {
    const { error } = await this.supabase.client().auth.signUp({
      email: dto.email,
      password: dto.password,
      options: { data: {
        first_name: dto.firstName, last_name: dto.lastName,
        terms_accepted_at: new Date().toISOString(), terms_version: '1.0',
      } },
    });
    if (error) throw new BadRequestException(error.message);
    return { message: 'If this email can be registered, a code has been sent.' };
  }

  async verifyEmail(dto: VerifyCodeDto) {
    const { data, error } = await this.supabase.client().auth.verifyOtp({
      email: dto.email, token: dto.code, type: 'email',
    });
    if (error || !data.session) throw new BadRequestException('Invalid or expired code');
    return data.session;
  }

  async resendCode(email: string) {
    await this.supabase.client().auth.resend({ type: 'signup', email });
    return { message: 'If the account exists, a new code has been sent.' };
  }

  async login(dto: LoginDto) {
    const { data, error } = await this.supabase.client().auth.signInWithPassword(dto);
    if (error || !data.session) {
      throw new UnauthorizedException('Invalid email or password, or email not verified');
    }
    return data.session;
  }

  async forgotPassword(email: string) {
    await this.supabase.client().auth.resetPasswordForEmail(email);
    return { message: 'If the account exists, a reset code has been sent.' }; // same reply either way
  }

  async resetPassword(dto: ResetPasswordDto) {
    const { data, error } = await this.supabase.client().auth.verifyOtp({
      email: dto.email, token: dto.code, type: 'recovery',
    });
    if (error || !data.user || !data.session) throw new BadRequestException('Invalid or expired code');
    await this.supabase.admin.auth.admin.updateUserById(data.user.id, { password: dto.newPassword });
    await this.supabase.admin.auth.admin.signOut(data.session.access_token, 'global'); // kill all sessions
    return { message: 'Password updated. Please log in.' };
  }

  async refresh(refreshToken: string) {
    const { data, error } = await this.supabase.client().auth.refreshSession({ refresh_token: refreshToken });
    if (error || !data.session) throw new UnauthorizedException();
    return data.session;
  }

  async logout(accessToken: string) {
    await this.supabase.admin.auth.admin.signOut(accessToken, 'local');
  }

  async me(userId: string) {
  const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
  if (!profile) throw new NotFoundException('Profile not found');
  return { ...profile, termsAccepted: !!profile.termsAcceptedAt };
}

async oauthCallback(dto: OAuthCallbackDto) {

  const { data: u, error } = await this.supabase.admin.auth.getUser(dto.accessToken);
  if (error || !u.user) throw new UnauthorizedException('Invalid session');

  
  const { data: s, error: e2 } = await this.supabase.client().auth.refreshSession({
    refresh_token: dto.refreshToken,
  });
  if (e2 || !s.session || s.user?.id !== u.user.id) throw new UnauthorizedException('Invalid session');

 
  if (dto.acceptedTerms) {
    await this.prisma.profile.updateMany({
      where: { id: u.user.id, termsAcceptedAt: null },
      data: { termsAcceptedAt: new Date(), termsVersion: '1.0' },
    });
  }

  return { session: s.session, profile: await this.me(u.user.id) };
}
}