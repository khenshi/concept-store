import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  ArrayMinSize,
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { PaymentMethod } from '../../../generated/prisma/client';
import { trimOptionalReference } from './checkout-dto.transforms';

const PAYMENT_AMOUNT_PATTERN =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/;

export class CreateSaleItemDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  productId!: string;

  @ApiProperty({ minimum: 1, maximum: 1_000_000 })
  @IsInt()
  @Min(1)
  @Max(1_000_000)
  quantity!: number;
}

export class CreateSalePaymentDto {
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;

  @ApiProperty({ type: String, example: '450.00' })
  @IsString()
  @Matches(PAYMENT_AMOUNT_PATTERN, {
    message: 'amount must be positive with at most 2 decimals',
  })
  amount!: string;

  @ApiPropertyOptional({ maxLength: 120, example: 'GCASH-10425' })
  @Transform(trimOptionalReference)
  @IsOptional()
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;
}

export class CreateSaleDto {
  @ApiProperty({ format: 'uuid', description: 'Client-generated retry key' })
  @IsUUID('4')
  clientTransactionId!: string;

  @ApiProperty({ type: CreateSaleItemDto, isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => CreateSaleItemDto)
  items!: CreateSaleItemDto[];

  @ApiProperty({ type: CreateSalePaymentDto, isArray: true, minItems: 1 })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => CreateSalePaymentDto)
  payments!: CreateSalePaymentDto[];
}
