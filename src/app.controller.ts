import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';

@ApiTags('App')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Welcome to Akumart API' })
  @ApiOkResponse({ type: String })
  getWelcome(): string {
    return this.appService.getWelcome();
  }

  @Get()
  @ApiOperation({ summary: 'Welcome to Akumart API' })
  @ApiOkResponse({ type: String })
  root(): string {
    return this.appService.getWelcome();
  }
}
