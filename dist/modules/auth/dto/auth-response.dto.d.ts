declare class AuthUserDto {
    id: string;
    email: string;
}
export declare class AuthResponseDto {
    accessToken: string;
    expiresAt: number;
    user: AuthUserDto;
}
export declare class MessageResponseDto {
    message: string;
}
export {};
