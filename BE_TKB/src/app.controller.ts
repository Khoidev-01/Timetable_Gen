import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { Public } from './auth/decorators/public.decorator';
import { ApiTags } from '@nestjs/swagger';

@ApiTags('Hệ thống')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /** Container health check - must answer without a token. */
  @Public()
  @Get()
  getHello(): string {
    return this.appService.getHello();
  }
}
