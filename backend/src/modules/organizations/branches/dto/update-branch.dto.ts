import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsISO31661Alpha2,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  normalizeNullableUppercaseString,
  normalizeRequiredUppercaseString,
  trimNullableString,
  trimRequiredString,
} from './branch-dto.transforms';

export class UpdateBranchDto {
  @ApiPropertyOptional({
    example: 'Makati Main',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 120)
  name?: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'MKT-01',
    minLength: 2,
    maxLength: 32,
  })
  @Transform(normalizeNullableUppercaseString)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string | null;

  @ApiPropertyOptional({
    example: '123 Retail Street',
    minLength: 2,
    maxLength: 200,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 200)
  addressLine1?: string;

  @ApiPropertyOptional({ nullable: true, maxLength: 200 })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @ApiPropertyOptional({ example: 'Makati', minLength: 2, maxLength: 100 })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 100)
  city?: string;

  @ApiPropertyOptional({
    example: 'Metro Manila',
    minLength: 2,
    maxLength: 100,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 100)
  province?: string;

  @ApiPropertyOptional({ nullable: true, example: '1200', maxLength: 20 })
  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @ApiPropertyOptional({ example: 'PH', minLength: 2, maxLength: 2 })
  @Transform(normalizeRequiredUppercaseString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsISO31661Alpha2()
  countryCode?: string;
}
