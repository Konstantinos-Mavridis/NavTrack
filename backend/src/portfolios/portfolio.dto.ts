import {
  IsString, IsOptional, IsNumber, IsPositive, IsUUID,
} from 'class-validator';

export class CreatePortfolioDto {
  @IsString() name: string;
  @IsOptional() @IsString() description?: string;
}

export class UpdatePortfolioDto {
  @IsOptional() @IsString() name?: string;
  @IsOptional() @IsString() description?: string;
}

export class UpsertPositionDto {
  @IsUUID() instrumentId: string;
  @IsNumber() @IsPositive() units: number;
  @IsOptional() @IsNumber() @IsPositive() costBasisPerUnit?: number;
  @IsOptional() @IsString() notes?: string;
}
