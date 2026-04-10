import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TemplatesService } from './templates.service';
import {
  CreateAllocationTemplateDto,
  UpdateAllocationTemplateDto,
} from './template.dto';

@Controller('templates')
export class TemplatesController {
  constructor(private readonly svc: TemplatesService) {}

  @Get()
  list() {
    return this.svc.list();
  }

  @Get(':id')
  getOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findOne(id);
  }

  @Get(':id/nav-preview')
  navPreview(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('tradeDate') tradeDate?: string,
  ) {
    return this.svc.navPreview(id, tradeDate);
  }

  @Post()
  create(@Body() dto: CreateAllocationTemplateDto) {
    return this.svc.create(dto);
  }

  @Put(':id')
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAllocationTemplateDto,
  ) {
    return this.svc.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.remove(id);
  }
}
