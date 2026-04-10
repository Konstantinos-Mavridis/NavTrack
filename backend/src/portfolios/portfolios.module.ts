import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Portfolio } from './portfolio.entity';
import { PortfolioPosition } from './portfolio-position.entity';
import { PortfoliosService } from './portfolios.service';
import { PortfoliosController } from './portfolios.controller';
import { Instrument } from '../instruments/instrument.entity';

@Module({
  imports: [TypeOrmModule.forFeature([Portfolio, PortfolioPosition, Instrument])],
  providers: [PortfoliosService],
  controllers: [PortfoliosController],
  exports: [PortfoliosService],
})
export class PortfoliosModule {}
