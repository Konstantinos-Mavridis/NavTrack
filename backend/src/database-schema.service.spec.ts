import { DatabaseSchemaService } from './database-schema.service';

describe('DatabaseSchemaService', () => {
  const originalRetries = process.env.DB_SCHEMA_READY_RETRIES;
  const originalDelay = process.env.DB_SCHEMA_READY_DELAY_MS;

  beforeEach(() => {
    process.env.DB_SCHEMA_READY_RETRIES = '1';
    process.env.DB_SCHEMA_READY_DELAY_MS = '0';
  });

  afterEach(() => {
    if (originalRetries === undefined) delete process.env.DB_SCHEMA_READY_RETRIES;
    else process.env.DB_SCHEMA_READY_RETRIES = originalRetries;

    if (originalDelay === undefined) delete process.env.DB_SCHEMA_READY_DELAY_MS;
    else process.env.DB_SCHEMA_READY_DELAY_MS = originalDelay;
  });

  it('waits for the schema type and then adds the CRYPTO asset class', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ ready: true }])
        .mockResolvedValueOnce(undefined),
      synchronize: jest.fn(),
    } as any;
    const service = new DatabaseSchemaService(dataSource);

    await service.onApplicationBootstrap();

    expect(dataSource.query).toHaveBeenNthCalledWith(
      1,
      "SELECT to_regtype('public.asset_class') IS NOT NULL AS ready",
    );
    expect(dataSource.query).toHaveBeenNthCalledWith(
      2,
      "ALTER TYPE asset_class ADD VALUE IF NOT EXISTS 'CRYPTO'",
    );
    expect(dataSource.synchronize).not.toHaveBeenCalled();
  });

  it('bootstraps an empty schema from TypeORM metadata when init.sql did not run', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ ready: false }])
        .mockResolvedValueOnce([{ ready: true }])
        .mockResolvedValueOnce(undefined),
      synchronize: jest.fn().mockResolvedValue(undefined),
    } as any;
    const service = new DatabaseSchemaService(dataSource);

    await service.onApplicationBootstrap();

    expect(dataSource.synchronize).toHaveBeenCalledWith(false);
    expect(dataSource.query).toHaveBeenLastCalledWith(
      "ALTER TYPE asset_class ADD VALUE IF NOT EXISTS 'CRYPTO'",
    );
  });
});
