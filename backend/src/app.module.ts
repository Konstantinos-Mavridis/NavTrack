import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InstrumentsModule } from './instruments/instruments.module';
import { PortfoliosModule } from './portfolios/portfolios.module';
import { NavPricesModule } from './nav-prices/nav-prices.module';
import { TransactionsModule } from './transactions/transactions.module';
import { ValuationModule } from './valuation/valuation.module';
import { SyncModule } from './sync/sync.module';
import { TemplatesModule } from './templates/templates.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (cfg: ConfigService) => ({
        type: 'postgres',
        host: cfg.get('POSTGRES_HOST', 'db'),
        port: cfg.get<number>('POSTGRES_PORT', 5432),
        database: cfg.get('POSTGRES_DB', 'portfolio_db'),
        username: cfg.get('POSTGRES_USER', 'portfolio_user'),
        password: cfg.get('POSTGRES_PASSWORD', 'portfolio_pass'),
        autoLoadEntities: true,
        synchronize: false,
        ssl: cfg.get('POSTGRES_SSL') === 'true' ? { rejectUnauthorized: false } : false,
        retryAttempts: 10,
        retryDelay: 3000,
      }),
    }),
    InstrumentsModule,
    PortfoliosModule,
    NavPricesModule,
    TransactionsModule,
    ValuationModule,
    SyncModule,
    TemplatesModule,
  ],
})
export class AppModule {}
