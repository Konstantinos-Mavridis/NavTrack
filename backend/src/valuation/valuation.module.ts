import { Module } from '@nestjs/common';
import { ValuationService } from './valuation.service';
import { ValuationController } from './valuation.controller';
import { PortfoliosModule } from '../portfolios/portfolios.module';
import { NavPricesModule } from '../nav-prices/nav-prices.module';

@Module({
  imports: [PortfoliosModule, NavPricesModule],
  providers: [ValuationService],
  controllers: [ValuationController],
})
export class ValuationModule {}
