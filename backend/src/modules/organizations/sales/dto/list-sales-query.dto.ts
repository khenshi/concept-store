import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { SalePaymentMethod } from '../../../../generated/prisma/client';
import {
  trimOptionalString,
  trimRequiredString,
} from '../../products/dto/product-dto.transforms';

const queryInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class ListSalesQueryDto {
  @ApiPropertyOptional({
    maxLength: 254,
    description: 'Case-insensitive receipt-code search',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Cashier actor ID' })
  @IsOptional()
  @IsUUID('4')
  cashierId?: string;

  @ApiPropertyOptional({ enum: SalePaymentMethod })
  @IsOptional()
  @IsEnum(SalePaymentMethod)
  paymentMethod?: SalePaymentMethod;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Inclusive UTC completion timestamp, ending in Z',
  })
  @Transform(trimRequiredString)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description: 'Exclusive UTC completion timestamp, ending in Z',
  })
  @Transform(trimRequiredString)
  @IsOptional()
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  until?: string;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 21474836,
    default: 1,
  })
  @Transform(queryInteger)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @ApiPropertyOptional({
    type: 'integer',
    minimum: 1,
    maximum: 100,
    default: 50,
  })
  @Transform(queryInteger)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit = 50;
}
