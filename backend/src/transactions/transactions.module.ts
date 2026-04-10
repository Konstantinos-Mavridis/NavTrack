import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Transaction } from './transaction.entity';
import { TransactionsService } from './transactions.service';
import { TransactionsController } from './transactions.controller';
import { AllocationTemplate } from '../templates/allocation-template.entity';
import { NavPricesModule } from '../nav-prices/nav-prices.module';

@Module({
  imports: [TypeOrmModule.forFeature([Transaction, AllocationTemplate]), NavPricesModule],
  providers: [TransactionsService],
  controllers: [TransactionsController],
  exports: [TransactionsService],
})
export class TransactionsModule {}
