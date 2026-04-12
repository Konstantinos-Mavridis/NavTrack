import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseIntPipe,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { TemplatesService } from './templates.service';
import {
  CreateAllocationTemplateDto,
  UpdateAllocationTemplateDto,
} from './template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  @Get()
  list() { return this.svc.list(); }

  @Get('export/json')
  exportJson() { return this.svc.exportJson(); }

  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.svc.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="templates-export.csv"');
    res.send(csv);
  }

  @Post('import/json')
  importJson(@Body() body: { templates: any[] }) {
    return this.svc.importJson(body.templates ?? []);
  }

  @Post('import/csv')
  importCsv(@Body() body: { csv: string }) {
    return this.svc.importCsv(body.csv ?? '');
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Get(':id/nav-preview')
  navPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tradeDate') tradeDate?: string,
  ) { return this.svc.navPreview(id, tradeDate); }

  /**
   * GET /templates/:id/nav-series?days=30
   *
   * Returns a daily weighted-NAV index series for the template.
   * `days` maps to UI ranges: 1M=30, 3M=90, 6M=180, 1Y=365.
   */
  @Get(':id/nav-series')
  navSeries(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('days', new ParseIntPipe({ optional: true })) days = 30,
  ) { return this.svc.navSeries(id, days); }

  @Post()
  create(@Body() dto: CreateAllocationTemplateDto) { return this.svc.create(dto); }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAllocationTemplateDto,
  ) { return this.svc.update(id, dto); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
