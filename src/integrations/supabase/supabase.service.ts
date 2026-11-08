import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  readonly admin: SupabaseClient;
  constructor(private config: ConfigService) {
    this.admin = this.make(config.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'));
  }
 
  client() {
    return this.make(this.config.getOrThrow('SUPABASE_ANON_KEY'));
  }
  private make(key: string) {
    return createClient(this.config.getOrThrow('SUPABASE_URL'), key, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
}