import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { SyncJob } from './sync-job.entity';
import { SyncService } from './sync.service';
import { SyncController } from './sync.controller';
import { YahooFinanceService } from './yahoo-finance.service';
import { Instrument } from '../instruments/instrument.entity';
import { NavPrice } from '../nav-prices/nav-price.entity';

@Module({
  imports: [TypeOrmModule.forFeature([SyncJob, Instrument, NavPrice])],
  providers: [SyncService, YahooFinanceService],
  controllers: [SyncController],
  exports: [SyncService],
})
export class SyncModule {}
