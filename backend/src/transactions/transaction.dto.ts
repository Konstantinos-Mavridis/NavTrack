import {
  IsEnum, IsDateString, IsNumber, IsPositive,
  IsOptional, IsString, IsUUID, Min,
} from 'class-validator';
import { TransactionType } from './transaction.entity';

export class CreateTransactionDto {
  @IsUUID()
  instrumentId: string;

  @IsEnum(TransactionType)
  type: TransactionType;

  @IsDateString()
  tradeDate: string;

  @IsOptional()
  @IsDateString()
  settlementDate?: string;

  @IsNumber()
  // Note: units can be negative for FEE_CONSOLIDATION (unit reduction).
  // Positivity is enforced at the service layer for all other types.
  units: number;

  @IsNumber()
  @IsPositive()
  pricePerUnit: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  fees?: number;

  @IsOptional()
  @IsString()
  notes?: string;
}

export class ApplyTemplateBuyDto {
  @IsUUID()
  templateId: string;

  @IsDateString()
  tradeDate: string;

  @IsOptional()
  @IsDateString()
  settlementDate?: string;

  @IsNumber()
  @IsPositive()
  totalAmount: number;

  @IsOptional()
  @IsString()
  notes?: string;
}
