import type { Request, Response } from 'express';
import { AuthService } from './auth.service';
import { EmailDto, LoginDto, OAuthCallbackDto, RegisterDto, ResetPasswordDto, VerifyCodeDto } from './dto';
export declare class AuthController {
    private readonly auth;
    constructor(auth: AuthService);
    register(dto: RegisterDto): Promise<{
        message: string;
    }>;
    verify(dto: VerifyCodeDto, res: Response): Promise<{
        accessToken: string;
        expiresAt: number | undefined;
        user: {
            id: string;
            email: string | undefined;
        };
    }>;
    resend(dto: EmailDto): Promise<{
        message: string;
    }>;
    login(dto: LoginDto, res: Response): Promise<{
        accessToken: string;
        expiresAt: number | undefined;
        user: {
            id: string;
            email: string | undefined;
        };
    }>;
    forgot(dto: EmailDto): Promise<{
        message: string;
    }>;
    reset(dto: ResetPasswordDto): Promise<{
        message: string;
    }>;
    refresh(req: Request, res: Response): Promise<{
        accessToken: string;
        expiresAt: number | undefined;
        user: {
            id: string;
            email: string | undefined;
        };
    }>;
    oauthCallback(dto: OAuthCallbackDto, res: Response): Promise<{
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
        accessToken: string;
        expiresAt: number | undefined;
        user: {
            id: string;
            email: string | undefined;
        };
    }>;
    me(req: any): Promise<{
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
    logout(req: any, res: Response): Promise<{
        message: string;
    }>;
    private respond;
}
