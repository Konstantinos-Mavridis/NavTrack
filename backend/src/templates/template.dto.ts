import {
  IsArray,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';

export class AllocationTemplateItemDto {
  @IsUUID()
  instrumentId: string;

  @IsNumber()
  @IsPositive()
  @Min(0.0001)
  weight: number;
}

export class CreateAllocationTemplateDto {
  @IsString()
  code: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationTemplateItemDto)
  items: AllocationTemplateItemDto[];
}

export class UpdateAllocationTemplateDto {
  @IsOptional()
  @IsString()
  code?: string;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AllocationTemplateItemDto)
  items?: AllocationTemplateItemDto[];
}
