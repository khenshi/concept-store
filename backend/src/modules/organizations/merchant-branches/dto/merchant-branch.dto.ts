import { Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { MerchantBranchStatus } from '../../../../generated/prisma/client';

export class ListMerchantBranchesDto {
  @ApiPropertyOptional({ default: 1, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(21474836)
  page = 1;

  @ApiPropertyOptional({ maxLength: 120 })
  @IsOptional()
  @IsString()
  @MaxLength(120)
  q?: string;

  @ApiPropertyOptional({ enum: MerchantBranchStatus })
  @IsOptional()
  @IsEnum(MerchantBranchStatus)
  status?: MerchantBranchStatus;
}

export class MerchantBranchStatusDto {
  @ApiProperty({ enum: MerchantBranchStatus })
  @IsEnum(MerchantBranchStatus)
  status!: MerchantBranchStatus;
}

export class EmptyMerchantBranchDto {}
