import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsInt,
  IsISO8601,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { trimRequiredString } from '../../products/dto/product-dto.transforms';

const queryInteger = ({ value }: { value: unknown }) =>
  typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : value;

export class ListSalesQueryDto {
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
