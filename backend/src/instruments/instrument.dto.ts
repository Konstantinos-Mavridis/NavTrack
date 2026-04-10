import { IsString, IsEnum, IsInt, Min, Max, IsArray, IsOptional, Length } from 'class-validator';
import { AssetClass } from './instrument.entity';

export class CreateInstrumentDto {
  @IsString()
  name: string;

  @IsString()
  @Length(12, 12, { message: 'ISIN must be exactly 12 characters' })
  isin: string;

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
