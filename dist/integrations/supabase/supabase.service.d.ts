import { ConfigService } from '@nestjs/config';
import { SupabaseClient } from '@supabase/supabase-js';
export declare class SupabaseService {
    private config;
    readonly admin: SupabaseClient;
    constructor(config: ConfigService);
    client(): SupabaseClient<any, "public", "public", any, any>;
    private make;
}
