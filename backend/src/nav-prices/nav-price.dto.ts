// nav-prices.dto.ts
import { IsDateString, IsNumber, IsPositive, IsEnum, IsOptional, IsArray, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { NavSource } from './nav-price.entity';

export class NavPriceEntryDto {
  @IsDateString()
  date: string;

  @IsNumber()
  @IsPositive()
  nav: number;

  @IsOptional()
  @IsEnum(NavSource)
  source?: NavSource;
}

export class BulkNavDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => NavPriceEntryDto)
  entries: NavPriceEntryDto[];
}
