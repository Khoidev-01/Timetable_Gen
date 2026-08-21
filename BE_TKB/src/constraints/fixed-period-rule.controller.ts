import { BadRequestException, Body, Controller, Delete, Get, Param, Post, Put } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';

const TEACHER_RULES = ['HOMEROOM', 'BGH', 'ASSIGNED'] as const;

/**
 * Fixed periods a school pins before the solver runs - chào cờ, sinh hoạt, GDĐP and the
 * like. These used to be hardcoded in the algorithm, so every school had to edit source
 * to change them.
 */
@ApiTags('Tiết cố định')
@ApiBearerAuth('access-token')
@Controller('tiet-co-dinh')
@Roles('ADMIN')
export class FixedPeriodRuleController {
  constructor(private readonly prisma: PrismaService) {}

  @Get()
  findAll() {
    return this.prisma.fixedPeriodRule.findMany({
      orderBy: [{ sort_order: 'asc' }, { day_of_week: 'asc' }, { period: 'asc' }],
    });
  }

  @Post()
  create(@Body() body: any) {
    return this.prisma.fixedPeriodRule.create({ data: this.validate(body) });
  }

  @Put(':id')
  update(@Param('id') id: string, @Body() body: any) {
    return this.prisma.fixedPeriodRule.update({
      where: { id },
      data: this.validate(body, true),
    });
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.prisma.fixedPeriodRule.delete({ where: { id } });
  }

  private validate(body: any, partial = false) {
    const data: any = {};

    const require = (field: string, value: any) => {
      if (value === undefined || value === null) {
        if (partial) return false;
        throw new BadRequestException(`Thiếu trường bắt buộc: ${field}`);
      }
      return true;
    };

    if (require('name', body.name)) data.name = String(body.name).trim();
    if (require('subject_code', body.subject_code)) {
      data.subject_code = String(body.subject_code).trim().toUpperCase();
    }

    if (require('day_of_week', body.day_of_week)) {
      const day = Number(body.day_of_week);
      if (!Number.isInteger(day) || day < 2 || day > 7) {
        throw new BadRequestException('day_of_week phải là số nguyên từ 2 (Thứ 2) đến 7 (Thứ 7).');
      }
      data.day_of_week = day;
    }

    if (require('period', body.period)) {
      const period = Number(body.period);
      if (!Number.isInteger(period) || period < 1 || period > 10) {
        throw new BadRequestException('period phải là số nguyên từ 1 đến 10.');
      }
      data.period = period;
    }

    if (body.teacher_rule !== undefined) {
      if (!TEACHER_RULES.includes(body.teacher_rule)) {
        throw new BadRequestException(`teacher_rule phải là một trong: ${TEACHER_RULES.join(', ')}`);
      }
      data.teacher_rule = body.teacher_rule;
    }

    if (body.grade_level !== undefined) {
      data.grade_level = body.grade_level === null ? null : Number(body.grade_level);
    }
    if (body.main_session !== undefined) {
      data.main_session = body.main_session === null ? null : Number(body.main_session);
    }
    if (body.is_locked !== undefined) data.is_locked = Boolean(body.is_locked);
    if (body.is_active !== undefined) data.is_active = Boolean(body.is_active);
    if (body.sort_order !== undefined) data.sort_order = Number(body.sort_order);

    return data;
  }
}
