import { Injectable, Logger, OnApplicationBootstrap } from '@nestjs/common';
import { DataSource } from 'typeorm';

const DEFAULT_SCHEMA_READY_RETRIES = 120;
const DEFAULT_SCHEMA_READY_DELAY_MS = 3000;

@Injectable()
export class DatabaseSchemaService implements OnApplicationBootstrap {
  private readonly logger = new Logger(DatabaseSchemaService.name);

  constructor(private readonly dataSource: DataSource) {}

  async onApplicationBootstrap(): Promise<void> {
    await this.waitForAssetClassType();
    await this.ensureCryptoAssetClass();
  }

  private async waitForAssetClassType(): Promise<void> {
    const retries = Number(process.env.DB_SCHEMA_READY_RETRIES ?? DEFAULT_SCHEMA_READY_RETRIES);
    const delayMs = Number(process.env.DB_SCHEMA_READY_DELAY_MS ?? DEFAULT_SCHEMA_READY_DELAY_MS);

    for (let attempt = 1; attempt <= retries; attempt++) {
      const rows = await this.dataSource.query(
        "SELECT to_regtype('public.asset_class') IS NOT NULL AS ready",
      );

      if (rows?.[0]?.ready === true) return;

      this.logger.log(
        `Database reachable but asset_class type not ready yet (attempt ${attempt}/${retries})`,
      );
      await sleep(delayMs);
    }

    throw new Error(`Database schema not ready after ${retries} attempts: asset_class type is missing`);
  }

  private async ensureCryptoAssetClass(): Promise<void> {
    await this.dataSource.query("ALTER TYPE asset_class ADD VALUE IF NOT EXISTS 'CRYPTO'");
    this.logger.log('Verified asset_class enum supports CRYPTO');
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
