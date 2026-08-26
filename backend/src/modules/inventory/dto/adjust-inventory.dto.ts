import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  MaxLength,
  Min,
  MinLength,
  NotEquals,
} from 'class-validator';
import {
  trimOptionalString,
  trimRequiredString,
} from './inventory-dto.transforms';

export class AdjustInventoryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  branchId!: string;

  @ApiProperty({ example: -2, minimum: -1000000000, maximum: 1000000000 })
  @IsInt()
  @Min(-1_000_000_000)
  @Max(1_000_000_000)
  @NotEquals(0)
  quantityChange!: number;

  @ApiProperty({ example: 'Physical count correction', maxLength: 500 })
  @Transform(trimRequiredString)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  note!: string;

  @ApiPropertyOptional({ example: 'COUNT-2026-08-26', maxLength: 120 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;
}
