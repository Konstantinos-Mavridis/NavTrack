import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

@Injectable()
export class DatabaseSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSchemaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.ensureCryptoAssetClass();
  }

  private async ensureCryptoAssetClass(): Promise<void> {
    await this.dataSource.query("ALTER TYPE asset_class ADD VALUE IF NOT EXISTS 'CRYPTO'");
    this.logger.log('Verified asset_class enum supports CRYPTO');
  }
}
