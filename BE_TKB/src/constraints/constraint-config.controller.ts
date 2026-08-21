import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { ConstraintSettingsService } from './constraint-settings.service';

@ApiTags('Cấu hình ràng buộc')
@ApiBearerAuth('access-token')
@Controller('cau-hinh-rang-buoc')
@Roles('ADMIN')
export class ConstraintConfigController {
  constructor(private readonly settings: ConstraintSettingsService) {}

  @Get()
  getAll() {
    return this.settings.list();
  }

  @Patch(':key')
  update(@Param('key') key: string, @Body() body: { weight?: number; isActive?: boolean }) {
    return this.settings.update(key, body);
  }

  /** Back to the weights the system ships with. */
  @Post('khoi-phuc-mac-dinh')
  reset() {
    return this.settings.reset();
  }
}
