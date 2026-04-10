import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseUUIDPipe, HttpCode, HttpStatus,
  Res,
} from '@nestjs/common';
import type { Response } from 'express';
import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto, UpdateInstrumentDto } from './instrument.dto';

@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly svc: InstrumentsService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

  @Get('export/json')
  exportJson() { return this.svc.exportJson(); }

  @Get('export/csv')
  async exportCsv(@Res() res: Response) {
    const csv = await this.svc.exportCsv();
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="instruments-export.csv"');
    res.send(csv);
  }

  @Post('import/json')
  importJson(@Body() body: { instruments: any[] }) {
    return this.svc.importJson(body.instruments ?? []);
  }

  @Post('import/csv')
  importCsv(@Body() body: { csv: string }) {
    return this.svc.importCsv(body.csv ?? '');
  }

  @Get(':id')
  findOne(@Param('id', ParseUUIDPipe) id: string) { return this.svc.findOne(id); }

  @Post()
  create(@Body() dto: CreateInstrumentDto) { return this.svc.create(dto); }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateInstrumentDto,
  ) { return this.svc.update(id, dto); }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) { return this.svc.remove(id); }
}
