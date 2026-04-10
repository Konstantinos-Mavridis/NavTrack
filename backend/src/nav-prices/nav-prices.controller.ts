// nav-prices.controller.ts
import { Controller, Get, Post, Param, Body, ParseUUIDPipe } from '@nestjs/common';
import { NavPricesService } from './nav-prices.service';
import { BulkNavDto } from './nav-price.dto';

@Controller('instruments/:id/nav')
export class NavPricesController {
  constructor(private readonly svc: NavPricesService) {}

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
