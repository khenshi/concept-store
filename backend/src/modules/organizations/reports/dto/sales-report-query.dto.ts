import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsISO8601, IsString, Matches } from 'class-validator';
import { trimRequiredString } from '../../products/dto/product-dto.transforms';

export class SalesReportQueryDto {
  @ApiProperty({
    format: 'date-time',
    description: 'Inclusive UTC completion timestamp ending in Z; required',
  })
  @Transform(trimRequiredString)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  from!: string;

  @ApiProperty({
    format: 'date-time',
    description:
      'Exclusive UTC completion timestamp ending in Z; required, after from and within 366 days',
  })
  @Transform(trimRequiredString)
  @IsString()
  @IsISO8601({ strict: true, strictSeparator: true })
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/)
  until!: string;
}

export class ReportBranchesQueryDto {}
