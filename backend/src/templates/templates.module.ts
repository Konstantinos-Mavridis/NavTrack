import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AllocationTemplate } from './allocation-template.entity';
import { AllocationTemplateItem } from './allocation-template-item.entity';
import { Instrument } from '../instruments/instrument.entity';
import { TemplatesService } from './templates.service';
import { TemplatesController } from './templates.controller';
import { NavPricesModule } from '../nav-prices/nav-prices.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([AllocationTemplate, AllocationTemplateItem, Instrument]),
    NavPricesModule,
  ],
  providers: [TemplatesService],
  controllers: [TemplatesController],
  exports: [TemplatesService],
})
export class TemplatesModule {}
