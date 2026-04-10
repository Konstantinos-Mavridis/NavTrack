import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { NavPrice } from './nav-price.entity';
import { NavPricesService } from './nav-prices.service';
import { NavPricesController } from './nav-prices.controller';
import { InstrumentsModule } from '../instruments/instruments.module';

@Module({
  imports: [TypeOrmModule.forFeature([NavPrice]), InstrumentsModule],
  providers: [NavPricesService],
  controllers: [NavPricesController],
  exports: [NavPricesService],
})
export class NavPricesModule {}
