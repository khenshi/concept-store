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
} from 'class-validator';
import { trimOptionalString } from './inventory-dto.transforms';

export class StockInDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  branchId!: string;

  @ApiProperty({ example: 12, minimum: 1, maximum: 1000000000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000_000)
  quantity!: number;

  @ApiPropertyOptional({ example: 'DELIVERY-1042', maxLength: 120 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceId?: string;

  @ApiPropertyOptional({ example: 'Received from merchant', maxLength: 500 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(500)
  note?: string;
}
