import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { SupabaseAuthGuard } from '../guard/supabase-auth.guard';
@Injectable()
export class OptionalAuthGuard implements CanActivate {
  constructor(private readonly auth: SupabaseAuthGuard) {}
  canActivate(context: ExecutionContext) {
    if (!context.switchToHttp().getRequest().headers.authorization) return true;
    return this.auth.canActivate(context);
  }
}
