import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseUUIDPipe, HttpCode, HttpStatus,
  Query,
  Header, UsePipes, ValidationPipe,
} from '@nestjs/common';
import { PortfoliosService } from './portfolios.service';
import { CreatePortfolioDto, UpdatePortfolioDto, UpsertPositionDto } from './portfolio.dto';

@Controller('portfolios')
export class PortfoliosController {
  constructor(private readonly svc: PortfoliosService) {}

  // ── Portfolios ────────────────────────────────────────────────────────────────────

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get('aggregate/valuation-series')
  aggregateSeries(
    // days is intentionally optional — when omitted the service anchors to the
    // earliest transaction date ("ALL" range) rather than a fixed day window.
    @Query('days') daysRaw?: string,
    @Query('to') to?: string,
    // Comma-separated list of portfolio UUIDs to include.
    // When omitted every portfolio is included (existing behaviour).
    @Query('ids') idsRaw?: string,
  ) {
    const days = daysRaw !== undefined ? parseInt(daysRaw, 10) : undefined;
    const ids  = idsRaw ? idsRaw.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    return this.svc.aggregateValuationSeries(days, to, ids);
  }

  @Get('export/json')
  exportJson() {
    return this.svc.exportPortfoliosJson();
  }

  @Get('export/csv')
  @Header('Content-Type', 'text/csv; charset=utf-8')
  exportCsv() {
    return this.svc.exportPortfoliosCsv();
  }

  @Post('import/json')
  @UsePipes(new ValidationPipe({ whitelist: false, forbidNonWhitelisted: false }))
  importJson(@Body() payload: any) {
    return this.svc.importPortfoliosFromJson(payload);
  }

  @Post('import/csv')
  importCsv(@Body('csv') csv: string) {
    return this.svc.importPortfoliosFromCsv(csv);
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: CreatePortfolioDto) { return this.svc.create(dto); }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdatePortfolioDto,
  ) { return this.svc.update(id, dto); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }

  // ── Positions ──────────────────────────────────────────────────────────────────

  @Get(':id/positions')
  getPositions(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.getPositions(id);
  }

  @Post(':id/positions')
  upsertPosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpsertPositionDto,
  ) { return this.svc.upsertPosition(id, dto); }

  @Delete(':id/positions/:positionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  removePosition(
    @Param('id', ParseUUIDPipe) id: string,
    @Param('positionId', ParseUUIDPipe) positionId: string,
  ) { return this.svc.removePosition(id, positionId); }

  /**
   * DELETE /portfolios/:id/positions — wipe all positions (clear demo data).
   */
  @Delete(':id/positions')
  @HttpCode(HttpStatus.OK)
  clearPositions(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.clearPositions(id);
  }

  /**
   * POST /portfolios/:id/positions/recalculate
   * Derive positions (units + weighted avg cost) from the transaction ledger.
   */
  @Post(':id/positions/recalculate')
  recalculate(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.recalculateFromTransactions(id);
  }
}
