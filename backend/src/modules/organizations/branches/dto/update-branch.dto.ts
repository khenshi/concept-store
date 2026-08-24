import { Transform } from 'class-transformer';
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
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 120)
  name?: string;

  @Transform(normalizeNullableUppercaseString)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string | null;

  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 200)
  addressLine1?: string;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string | null;

  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 100)
  city?: string;

  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 100)
  province?: string;

  @Transform(trimNullableString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string | null;

  @Transform(normalizeRequiredUppercaseString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @IsISO31661Alpha2()
  countryCode?: string;
}
