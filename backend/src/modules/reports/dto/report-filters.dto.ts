import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, IsUUID, Matches } from 'class-validator';

const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export class ReportFiltersDto {
  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'from must be an ISO date' })
  from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @IsOptional()
  @IsString()
  @Matches(DATE_ONLY_PATTERN, { message: 'to must be an ISO date' })
  to?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  merchantId?: string;
}
