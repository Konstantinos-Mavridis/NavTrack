import { DatabaseSchemaService } from './database-schema.service';

describe('DatabaseSchemaService', () => {
  it('adds the CRYPTO asset class on application bootstrap', async () => {
    const dataSource = { query: jest.fn().mockResolvedValue(undefined) } as any;
    const service = new DatabaseSchemaService(dataSource);

    await service.onApplicationBootstrap();

    expect(dataSource.query).toHaveBeenCalledWith(
      "ALTER TYPE asset_class ADD VALUE IF NOT EXISTS 'CRYPTO'",
    );
  });
});
