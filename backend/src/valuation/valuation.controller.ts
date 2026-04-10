import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import { ValuationService } from './valuation.service';

@Controller('portfolios/:id/valuation')
export class ValuationController {
  constructor(private readonly svc: ValuationService) {}

  @Get()
  compute(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('date') date?: string,
  ) {
    return this.svc.compute(id, date);
  }
}
