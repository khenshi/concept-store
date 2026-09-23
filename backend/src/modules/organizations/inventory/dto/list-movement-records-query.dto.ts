import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsISO8601,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { InventoryMovementType } from '../../../../generated/prisma/client';
import { trimOptionalString } from '../../products/dto/product-dto.transforms';

const queryInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

const queryDate = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListMovementRecordsQueryDto {
  @ApiPropertyOptional({
    maxLength: 254,
    description:
      'Case-insensitive product/reason search; barcode matching preserves case',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({ enum: InventoryMovementType })
  @IsOptional()
  @IsEnum(InventoryMovementType)
  type?: InventoryMovementType;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  merchantId?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inclusive UTC timestamp',
  })
  @Transform(queryDate)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Exclusive UTC timestamp after the inclusive date range',
  })
  @Transform(queryDate)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  until?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 10,
  })
  @Transform(queryInteger)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 10;

  @ApiPropertyOptional({
    description: 'Opaque cursor returned by the preceding page',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(512)
  cursor?: string;
}
