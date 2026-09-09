import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsEnum,
  IsISO8601,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import {
  AgreementPrepaymentKind,
  PaymentMethod,
} from '../../../generated/prisma/client';
import { POSITIVE_MONEY_PATTERN } from './create-merchant-agreement.dto';

const trim = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class AgreementReasonDto {
  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class RecordPrepaymentCollectionDto {
  @ApiProperty({ type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN)
  amount!: string;
  @ApiProperty({ enum: PaymentMethod })
  @IsEnum(PaymentMethod)
  method!: PaymentMethod;
  @ApiPropertyOptional()
  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(120)
  referenceNumber?: string;
  @ApiProperty({ format: 'date-time' })
  @IsISO8601({ strict: true, strictSeparator: true })
  occurredAt!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;
}

export class RecordPrepaymentRefundDto extends RecordPrepaymentCollectionDto {
  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class RecordDepositDeductionDto {
  @ApiProperty({ type: String })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN)
  amount!: string;
  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  requestId!: string;
}

export enum CancellationResolution {
  REFUND = 'REFUND',
  RETAIN = 'RETAIN',
}

export class CancellationItemDto {
  @ApiProperty({ enum: AgreementPrepaymentKind })
  @IsEnum(AgreementPrepaymentKind)
  kind!: AgreementPrepaymentKind;
  @ApiProperty({ enum: CancellationResolution })
  @IsEnum(CancellationResolution)
  resolution!: CancellationResolution;
  @ApiPropertyOptional({ enum: PaymentMethod })
  @IsOptional()
  @IsEnum(PaymentMethod)
  method?: PaymentMethod;
  @ApiProperty({ maxLength: 500 })
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(500)
  reason!: string;
}

export class CancelAgreementDto extends AgreementReasonDto {
  @ApiProperty({ type: [CancellationItemDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CancellationItemDto)
  resolutions!: CancellationItemDto[];
}
