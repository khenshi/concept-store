import { Transform } from 'class-transformer';
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
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @Transform(normalizeUppercaseString)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string;

  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 200)
  addressLine1!: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(200)
  addressLine2?: string;

  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 100)
  city!: string;

  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 100)
  province!: string;

  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @MaxLength(20)
  postalCode?: string;

  @Transform(normalizeUppercaseString)
  @IsString()
  @IsISO31661Alpha2()
  countryCode!: string;
}
