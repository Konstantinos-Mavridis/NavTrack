import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { InstrumentsService } from './instruments.service';
import { CreateInstrumentDto, UpdateInstrumentDto } from './instrument.dto';

@Controller('instruments')
export class InstrumentsController {
  constructor(private readonly svc: InstrumentsService) {}

  @Get()
  findAll() { return this.svc.findAll(); }

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
