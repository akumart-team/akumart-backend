import { SupabaseService } from '../../integrations/supabase/supabase.service';
import { RegisterDto, VerifyCodeDto, LoginDto, ResetPasswordDto, OAuthCallbackDto } from './dto';
import { PrismaService } from '../../integrations/database/prisma.service';
export declare class AuthService {
    private supabase;
    private prisma;
    constructor(supabase: SupabaseService, prisma: PrismaService);
    register(dto: RegisterDto): Promise<{
        message: string;
    }>;
    verifyEmail(dto: VerifyCodeDto): Promise<import("@supabase/auth-js").Session>;
    resendCode(email: string): Promise<{
        message: string;
    }>;
    login(dto: LoginDto): Promise<import("@supabase/auth-js").Session>;
    forgotPassword(email: string): Promise<{
        message: string;
    }>;
    resetPassword(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    refresh(refreshToken: string): Promise<import("@supabase/auth-js").Session>;
    logout(accessToken: string): Promise<void>;
    me(userId: string): Promise<{
        termsAccepted: boolean;
        firstName: string;
        lastName: string;
        email: string;
        id: string;
        termsAcceptedAt: Date | null;
        termsVersion: string | null;
        companyName: string | null;
        businessType: string | null;
        location: string | null;
        profileCompleted: boolean;
        createdAt: Date;
        updatedAt: Date;
    }>;
    oauthCallback(dto: OAuthCallbackDto): Promise<{
        session: import("@supabase/auth-js").Session;
        profile: {
            termsAccepted: boolean;
            firstName: string;
            lastName: string;
            email: string;
            id: string;
            termsAcceptedAt: Date | null;
            termsVersion: string | null;
            companyName: string | null;
            businessType: string | null;
            location: string | null;
            profileCompleted: boolean;
            createdAt: Date;
            updatedAt: Date;
        };
    }>;
}
