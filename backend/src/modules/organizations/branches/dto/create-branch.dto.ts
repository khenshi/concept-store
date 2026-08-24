import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  normalizeUppercaseString,
  trimOptionalString,
  trimRequiredString,
} from './branch-dto.transforms';

export class CreateBranchDto {
  @ApiProperty({ example: 'Makati Main', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({
    example: 'MKT-01',
    minLength: 2,
    maxLength: 32,
  })
  @Transform(normalizeUppercaseString)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string;

  @ApiProperty({
    example: '123 Retail Street',
    minLength: 2,
    maxLength: 200,
  })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 200)
  addressLine1!: string;

  @ApiPropertyOptional({ maxLength: 200 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @ApiProperty({ example: 'Makati', minLength: 2, maxLength: 100 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 100)
  city!: string;

  @ApiProperty({ example: 'Metro Manila', minLength: 2, maxLength: 100 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 100)
  province!: string;

  @ApiPropertyOptional({ example: '1200', maxLength: 20 })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @ApiProperty({ example: 'PH', minLength: 2, maxLength: 2 })
  @Transform(normalizeUppercaseString)
  @IsString()
  @IsISO31661Alpha2()
  countryCode!: string;
}
