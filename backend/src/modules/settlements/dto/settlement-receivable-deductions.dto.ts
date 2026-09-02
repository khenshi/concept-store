import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

const POSITIVE_MONEY_PATTERN =
  /^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/;

export class SettlementReceivableDeductionDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  receivableId!: string;

  @ApiProperty({ type: String, example: '2500.00' })
  @IsString()
  @Matches(POSITIVE_MONEY_PATTERN, {
    message: 'amount must be positive with at most 2 decimals',
  })
  amount!: string;
}

export class SettlementReceivableDeductionsDto {
  @ApiPropertyOptional({
    type: SettlementReceivableDeductionDto,
    isArray: true,
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => SettlementReceivableDeductionDto)
  receivableDeductions: SettlementReceivableDeductionDto[] = [];
}
