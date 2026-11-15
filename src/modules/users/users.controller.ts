import { Body, Controller, Get, Patch, Post, Req } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { Authenticated, type AuthRequest } from '../../common/platform/api';
import { UsersService } from './users.service';
import {
  PreferencesDto,
  UpdatePreferencesDto,
  UpdateProfileDto,
} from './dto/user.dto';
@ApiTags('Users')
@Authenticated()
@Controller({ path: 'users/me', version: '1' })
export class UsersController {
  constructor(private readonly users: UsersService) {}
  @Get() me(@Req() r: AuthRequest) {
    return this.users.me(r.user.id, r.user);
  }
  @Patch() update(@Req() r: AuthRequest, @Body() dto: UpdateProfileDto) {
    return this.users.update(r.user.id, dto);
  }
  @Patch('preferences') preferences(
    @Req() r: AuthRequest,
    @Body() dto: UpdatePreferencesDto,
  ) {
    return this.users.preferences(r.user.id, dto);
  }
  @Post('onboarding/complete') complete(
    @Req() r: AuthRequest,
    @Body() dto: PreferencesDto,
  ) {
    return this.users.complete(r.user.id, dto);
  }
  @Get('dashboard') dashboard(@Req() r: AuthRequest) {
    return this.users.dashboard(r.user.id);
  }
}
