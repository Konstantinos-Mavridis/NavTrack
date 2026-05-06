import { DatabaseSchemaService } from './database-schema.service';

describe('DatabaseSchemaService', () => {
  it('waits for the schema type and then adds the CRYPTO asset class', async () => {
    const dataSource = {
      query: jest.fn()
        .mockResolvedValueOnce([{ ready: true }])
        .mockResolvedValueOnce(undefined),
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
  });
});
