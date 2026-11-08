import { CanActivate, ExecutionContext } from '@nestjs/common';
import { SupabaseService } from '../../integrations/supabase/supabase.service';
export declare class SupabaseAuthGuard implements CanActivate {
    private supabase;
    constructor(supabase: SupabaseService);
    canActivate(ctx: ExecutionContext): Promise<boolean>;
}
