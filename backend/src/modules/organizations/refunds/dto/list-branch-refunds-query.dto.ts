import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  ValidateIf,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
} from 'class-validator';
import { SalePaymentMethod } from '../../../../generated/prisma/client';
import {
  trimOptionalString,
  trimRequiredString,
} from '../../products/dto/product-dto.transforms';
import { ListRefundsQueryDto } from './list-refunds-query.dto';

@ValidatorConstraint({ name: 'refundUtcTimestamp', async: false })
class RefundUtcTimestamp implements ValidatorConstraintInterface {
  validate(value: unknown) {
    if (
      typeof value !== 'string' ||
      !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(
        value,
      )
    )
      return false;
    const parsed = new Date(value);
    return (
      Number.isFinite(parsed.getTime()) &&
      parsed.toISOString().slice(0, 19) === value.slice(0, 19)
    );
  }

  defaultMessage() {
    return 'timestamp must be a valid UTC date ending in Z within years 0001–9999';
  }
}

export class ListBranchRefundsQueryDto extends ListRefundsQueryDto {
  @ApiPropertyOptional({
    maxLength: 254,
    description:
      'Case-insensitive literal substring of refund code or original receipt',
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({ enum: SalePaymentMethod })
  @IsOptional()
  @IsEnum(SalePaymentMethod)
  paymentMethod?: SalePaymentMethod;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Inclusive UTC refund completion timestamp ending in Z, years 0001–9999; requires until',
  })
  @Transform(trimRequiredString)
  @ValidateIf(
    (query: ListBranchRefundsQueryDto) =>
      query.from !== undefined || query.until !== undefined,
  )
  @IsString()
  @Validate(RefundUtcTimestamp)
  from?: string;

  @ApiPropertyOptional({
    format: 'date-time',
    description:
      'Exclusive UTC refund completion timestamp ending in Z, years 0001–9999; requires from',
  })
  @Transform(trimRequiredString)
  @ValidateIf(
    (query: ListBranchRefundsQueryDto) =>
      query.from !== undefined || query.until !== undefined,
  )
  @IsString()
  @Validate(RefundUtcTimestamp)
  until?: string;
}
