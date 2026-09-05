import { Body, Controller, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { UserRole } from '@prisma/client';
import { CurrentUser, AuthenticatedUser } from '../../common/decorators/current-user.decorator';
import { ShiftsService } from './shifts.service';
import { OpenShiftDto } from './dto/open-shift.dto';
import { CloseShiftDto } from './dto/close-shift.dto';

@ApiTags('Shifts')
@ApiBearerAuth()
@Controller('shifts')
export class ShiftsController {
  constructor(private readonly shiftsService: ShiftsService) {}

  @Post('open')
  @ApiOperation({ summary: 'فتح وردية جديدة للمستخدم الحالي (من التوكن)' })
  open(@Body() dto: OpenShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.open(user.userId, dto);
  }

  @Get('open/me')
  @ApiOperation({ summary: 'الوردية المفتوحة حالياً للمستخدم الحالي' })
  findOpen(@CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.findOpenByCashier(user.userId);
  }

  @Get(':shiftId/summary')
  @ApiOperation({ summary: 'Get shift summary for closing (expected cash, sales totals)' })
  getSummary(@Param('shiftId') shiftId: string, @CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.getSummary(shiftId, { userId: user.userId, role: user.role as UserRole });
  }

  @Patch(':shiftId/close')
  @ApiOperation({ summary: 'Close an active shift' })
  close(@Param('shiftId') shiftId: string, @Body() dto: CloseShiftDto, @CurrentUser() user: AuthenticatedUser) {
    return this.shiftsService.close(shiftId, dto, { userId: user.userId, role: user.role as UserRole });
  }
}
