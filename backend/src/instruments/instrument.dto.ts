import {
  IsString, IsEnum, IsInt, Min, Max,
  IsArray, IsOptional, Length,
  ValidateIf, registerDecorator, ValidationOptions,
  ValidationArguments,
} from 'class-validator';
import { AssetClass } from './instrument.entity';

/**
 * Custom validator: at least one of `isin` or `ticker` must be provided.
 * Used on both fields so the error message is attached to whichever field
 * the consumer looks at.
 */
function RequiresIsinOrTicker(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'requiresIsinOrTicker',
      target: (object as any).constructor,
      propertyName,
      options: {
        message: 'At least one of isin or ticker must be provided',
        ...validationOptions,
      },
      validator: {
        validate(_value: unknown, args: ValidationArguments) {
          const obj = args.object as CreateInstrumentDto;
          return !!(obj.isin || obj.ticker);
        },
      },
    });
  };
}

export class CreateInstrumentDto {
  @IsString()
  name: string;

  /**
   * Standard 12-character ISIN (e.g. "LU0273962166").
   * Required for mutual funds / ETFs. Omit for crypto instruments.
   */
  @IsOptional()
  @IsString()
  @Length(12, 12, { message: 'ISIN must be exactly 12 characters' })
  @RequiresIsinOrTicker()
  isin?: string;

  /**
   * Direct Yahoo Finance ticker symbol (e.g. "BTC-USD", "ETH-USD").
   * Required when isin is omitted. May also be set alongside an ISIN
   * to skip Yahoo ticker-resolution in the worker.
   */
  @IsOptional()
  @IsString()
  @ValidateIf((o) => !o.isin)   // ticker is mandatory when isin is absent
  @RequiresIsinOrTicker()
  ticker?: string;

  @IsOptional()
  @IsString()
  @Length(3, 3)
  currency?: string;

  @IsEnum(AssetClass)
  assetClass: AssetClass;

  @IsInt()
  @Min(1)
  @Max(7)
  riskLevel: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataSources?: string[];
}

export class UpdateInstrumentDto {
  @IsOptional()
  @IsString()
  name?: string;

  @IsOptional()
  @IsString()
  @Length(12, 12, { message: 'ISIN must be exactly 12 characters' })
  isin?: string;

  @IsOptional()
  @IsString()
  ticker?: string;

  @IsOptional()
  @IsEnum(AssetClass)
  assetClass?: AssetClass;

  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(7)
  riskLevel?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  dataSources?: string[];
}
