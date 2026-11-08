"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AuthService = void 0;
const common_1 = require("@nestjs/common");
const supabase_service_1 = require("../../integrations/supabase/supabase.service");
const prisma_service_1 = require("../../integrations/database/prisma.service");
let AuthService = class AuthService {
    supabase;
    prisma;
    constructor(supabase, prisma) {
        this.supabase = supabase;
        this.prisma = prisma;
    }
    async register(dto) {
        const { error } = await this.supabase.client().auth.signUp({
            email: dto.email,
            password: dto.password,
            options: { data: {
                    first_name: dto.firstName, last_name: dto.lastName,
                    terms_accepted_at: new Date().toISOString(), terms_version: '1.0',
                } },
        });
        if (error)
            throw new common_1.BadRequestException(error.message);
        return { message: 'If this email can be registered, a code has been sent.' };
    }
    async verifyEmail(dto) {
        const { data, error } = await this.supabase.client().auth.verifyOtp({
            email: dto.email, token: dto.code, type: 'email',
        });
        if (error || !data.session)
            throw new common_1.BadRequestException('Invalid or expired code');
        return data.session;
    }
    async resendCode(email) {
        await this.supabase.client().auth.resend({ type: 'signup', email });
        return { message: 'If the account exists, a new code has been sent.' };
    }
    async login(dto) {
        const { data, error } = await this.supabase.client().auth.signInWithPassword(dto);
        if (error || !data.session) {
            throw new common_1.UnauthorizedException('Invalid email or password, or email not verified');
        }
        return data.session;
    }
    async forgotPassword(email) {
        await this.supabase.client().auth.resetPasswordForEmail(email);
        return { message: 'If the account exists, a reset code has been sent.' };
    }
    async resetPassword(dto) {
        const { data, error } = await this.supabase.client().auth.verifyOtp({
            email: dto.email, token: dto.code, type: 'recovery',
        });
        if (error || !data.user || !data.session)
            throw new common_1.BadRequestException('Invalid or expired code');
        await this.supabase.admin.auth.admin.updateUserById(data.user.id, { password: dto.newPassword });
        await this.supabase.admin.auth.admin.signOut(data.session.access_token, 'global');
        return { message: 'Password updated. Please log in.' };
    }
    async refresh(refreshToken) {
        const { data, error } = await this.supabase.client().auth.refreshSession({ refresh_token: refreshToken });
        if (error || !data.session)
            throw new common_1.UnauthorizedException();
        return data.session;
    }
    async logout(accessToken) {
        await this.supabase.admin.auth.admin.signOut(accessToken, 'local');
    }
    async me(userId) {
        const profile = await this.prisma.profile.findUnique({ where: { id: userId } });
        if (!profile)
            throw new common_1.NotFoundException('Profile not found');
        return { ...profile, termsAccepted: !!profile.termsAcceptedAt };
    }
    async oauthCallback(dto) {
        const { data: u, error } = await this.supabase.admin.auth.getUser(dto.accessToken);
        if (error || !u.user)
            throw new common_1.UnauthorizedException('Invalid session');
        const { data: s, error: e2 } = await this.supabase.client().auth.refreshSession({
            refresh_token: dto.refreshToken,
        });
        if (e2 || !s.session || s.user?.id !== u.user.id)
            throw new common_1.UnauthorizedException('Invalid session');
        if (dto.acceptedTerms) {
            await this.prisma.profile.updateMany({
                where: { id: u.user.id, termsAcceptedAt: null },
                data: { termsAcceptedAt: new Date(), termsVersion: '1.0' },
            });
        }
        return { session: s.session, profile: await this.me(u.user.id) };
    }
};
exports.AuthService = AuthService;
exports.AuthService = AuthService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [supabase_service_1.SupabaseService, prisma_service_1.PrismaService])
], AuthService);
//# sourceMappingURL=auth.service.js.map