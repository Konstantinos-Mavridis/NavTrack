/**
 * Unit tests for CreateInstrumentDto and UpdateInstrumentDto.
 *
 * Validates that the @ValidateIf cross-field constraint
 * ("either isin or ticker must be present") and all other
 * class-validator decorators work as expected.
 *
 * Uses class-validator's validate() directly — no NestJS DI required.
 */
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CreateInstrumentDto, UpdateInstrumentDto } from './instrument.dto';
import { AssetClass } from './instrument.entity';

/** Minimal valid base for a CreateInstrumentDto. */
const BASE_CREATE = {
  name: 'Test Fund',
  isin: 'IE0001234567',
  currency: 'EUR',
  assetClass: AssetClass.EQUITY,
  riskLevel: 3,
};

async function errorsFor(cls: any, plain: Record<string, unknown>) {
  const instance = plainToInstance(cls, plain) as object;
  return validate(instance);
}

describe('CreateInstrumentDto', () => {
  describe('identifier cross-field rule', () => {
    it('passes when only isin is provided', async () => {
      const errors = await errorsFor(CreateInstrumentDto, { ...BASE_CREATE });
      expect(errors).toHaveLength(0);
    });

    it('passes when only ticker is provided (no isin)', async () => {
      const { isin: _isin, ...base } = BASE_CREATE;
      const errors = await errorsFor(CreateInstrumentDto, {
        ...base,
        ticker: 'BTC-USD',
        assetClass: AssetClass.CRYPTO,
      });
      expect(errors).toHaveLength(0);
    });

    it('passes when both isin and ticker are provided', async () => {
      const errors = await errorsFor(CreateInstrumentDto, {
        ...BASE_CREATE,
        ticker: 'HYB-USD',
      });
      expect(errors).toHaveLength(0);
    });

    it('fails when neither isin nor ticker is provided', async () => {
      const { isin: _isin, ...base } = BASE_CREATE;
      const errors = await errorsFor(CreateInstrumentDto, base);
      // @ValidateIf fires on both fields when both are absent:
      // isin: required because ticker is absent
      // ticker: required because isin is absent
      const props = errors.map((e) => e.property);
      expect(props).toContain('isin');
      expect(props).toContain('ticker');
    });
  });

  describe('isin format', () => {
    it('fails when isin is not exactly 12 characters', async () => {
      const errors = await errorsFor(CreateInstrumentDto, {
        ...BASE_CREATE,
        isin: 'SHORT',
      });
      const isinError = errors.find((e) => e.property === 'isin');
      expect(isinError).toBeDefined();
      expect(Object.values(isinError!.constraints || {}).join('')).toContain(
        'ISIN must be exactly 12 characters',
      );
    });
  });

  describe('assetClass', () => {
    it('fails when assetClass is not a valid enum value', async () => {
      const errors = await errorsFor(CreateInstrumentDto, {
        ...BASE_CREATE,
        assetClass: 'INVALID_CLASS',
      });
      expect(errors.some((e) => e.property === 'assetClass')).toBe(true);
    });

    it('passes for CRYPTO asset class with ticker', async () => {
      const { isin: _isin, ...base } = BASE_CREATE;
      const errors = await errorsFor(CreateInstrumentDto, {
        ...base,
        ticker: 'ETH-USD',
        assetClass: AssetClass.CRYPTO,
      });
      expect(errors).toHaveLength(0);
    });

    it('passes for CRYPTO asset class with isin (not forbidden)', async () => {
      const errors = await errorsFor(CreateInstrumentDto, {
        ...BASE_CREATE,
        assetClass: AssetClass.CRYPTO,
        ticker: 'ETH-USD',
      });
      expect(errors).toHaveLength(0);
    });
  });

  describe('riskLevel', () => {
    it('fails when riskLevel is below 1', async () => {
      const errors = await errorsFor(CreateInstrumentDto, {
        ...BASE_CREATE,
        riskLevel: 0,
      });
      expect(errors.some((e) => e.property === 'riskLevel')).toBe(true);
    });

    it('fails when riskLevel is above 7', async () => {
      const errors = await errorsFor(CreateInstrumentDto, {
        ...BASE_CREATE,
        riskLevel: 8,
      });
      expect(errors.some((e) => e.property === 'riskLevel')).toBe(true);
    });
  });
});

describe('UpdateInstrumentDto', () => {
  it('passes with an empty object (all fields optional)', async () => {
    const errors = await errorsFor(UpdateInstrumentDto, {});
    expect(errors).toHaveLength(0);
  });

  it('passes when only name is provided', async () => {
    const errors = await errorsFor(UpdateInstrumentDto, { name: 'New Name' });
    expect(errors).toHaveLength(0);
  });

  it('passes when isin is explicitly null (clears the field)', async () => {
    // @ValidateIf skips Length check when isin is null
    const errors = await errorsFor(UpdateInstrumentDto, { isin: null });
    expect(errors).toHaveLength(0);
  });

  it('passes when ticker is explicitly null (clears the field)', async () => {
    // @ValidateIf skips IsString check when ticker is null
    const errors = await errorsFor(UpdateInstrumentDto, { ticker: null });
    expect(errors).toHaveLength(0);
  });

  it('fails when isin is a non-null string of wrong length', async () => {
    const errors = await errorsFor(UpdateInstrumentDto, { isin: 'SHORT' });
    const isinError = errors.find((e) => e.property === 'isin');
    expect(isinError).toBeDefined();
    expect(Object.values(isinError!.constraints || {}).join('')).toContain(
      'ISIN must be exactly 12 characters',
    );
  });
});
