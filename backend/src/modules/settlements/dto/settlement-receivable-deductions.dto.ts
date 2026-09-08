import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  ValidateNested,
} from 'class-validator';

export class RentApplicationDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  receivableId!: string;

  @ApiProperty({ type: String, example: '1250.00' })
  @IsString()
  @Matches(/^(?:0\.(?:0[1-9]|[1-9]\d?)|[1-9]\d{0,11}(?:\.\d{1,2})?)$/)
  amount!: string;
}

export class SettlementReceivableDeductionsDto {
  @ApiPropertyOptional({ type: RentApplicationDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => RentApplicationDto)
  rentApplications?: RentApplicationDto[];

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  requestId?: string;

  @ApiPropertyOptional({
    description: 'Opaque preview revision returned by the preview endpoint.',
  })
  @IsOptional()
  @IsString()
  previewRevision?: string;

  @ApiPropertyOptional({
    type: Boolean,
    deprecated: true,
    description:
      'Legacy shortcut. New clients should send rentApplications with explicit amounts.',
  })
  @IsOptional()
  @IsBoolean()
  deductOutstandingRent?: boolean;
}
