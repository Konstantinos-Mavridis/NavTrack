import { Controller, Get, Post, Param, Query, Body, ParseUUIDPipe, BadRequestException } from '@nestjs/common';
import { NavPricesService } from './nav-prices.service';
import { BulkNavDto } from './nav-price.dto';

@Controller('instruments/:id/nav')
export class NavPricesController {
  constructor(private readonly svc: NavPricesService) {}

  /**
   * GET /instruments/:id/nav/on-date?date=YYYY-MM-DD
   *
   * Returns the most recent NAV on or before `date`, or null if none exists.
   * Used by the Add Transaction modal to auto-populate the Price/Unit field.
   */
  @Get('on-date')
  navOnDate(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date?: string,
  ) {
    if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      throw new BadRequestException('date query param is required in YYYY-MM-DD format');
    }
    return this.svc.navOnDate(id, date);
  }

  @Get()
  findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findByInstrument(id);
  }

  @Post()
  bulkUpsert(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: BulkNavDto,
  ) {
    return this.svc.bulkUpsert(id, dto.entries);
  }
}
