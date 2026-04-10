import {
  Controller, Get, Post, Put, Delete,
  Param, Body, ParseUUIDPipe, HttpCode, HttpStatus,
} from '@nestjs/common';
import { TransactionsService } from './transactions.service';
import { ApplyTemplateBuyDto, CreateTransactionDto } from './transaction.dto';

@Controller('portfolios/:id/transactions')
export class TransactionsController {
  constructor(private readonly svc: TransactionsService) {}

  @Get()
  findAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.findByPortfolio(id);
  }

  @Post()
  create(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: CreateTransactionDto,
  ) {
    return this.svc.create(id, dto);
  }

  @Post('apply-template')
  applyTemplate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ApplyTemplateBuyDto,
  ) {
    return this.svc.applyTemplateBuy(id, dto);
  }

  @Put(':txnId')
  update(
    @Param('id', ParseUUIDPipe)    id: string,
    @Param('txnId', ParseUUIDPipe) txnId: string,
    @Body() dto: Partial<CreateTransactionDto>,
  ) {
    return this.svc.update(id, txnId, dto);
  }

  @Delete(':txnId')
  @HttpCode(HttpStatus.NO_CONTENT)
  remove(
    @Param('id', ParseUUIDPipe)    id: string,
    @Param('txnId', ParseUUIDPipe) txnId: string,
  ) {
    return this.svc.remove(id, txnId);
  }

  /** DELETE /portfolios/:id/transactions — wipe all (clear demo data) */
  @Delete()
  @HttpCode(HttpStatus.OK)
  clearAll(@Param('id', ParseUUIDPipe) id: string) {
    return this.svc.clearAll(id);
  }
}
