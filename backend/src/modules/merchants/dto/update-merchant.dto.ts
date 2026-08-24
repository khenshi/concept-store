import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import {
  normalizeEmail,
  normalizeNullableCode,
  trimRequiredString,
} from './merchant-dto.transforms';

export class UpdateMerchantDto {
  @ApiPropertyOptional({
    example: 'Amihan Goods',
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
    example: 'AMIHAN-01',
    minLength: 2,
    maxLength: 32,
  })
  @Transform(normalizeNullableCode)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string | null;

  @ApiPropertyOptional({
    example: 'Maria Santos',
    minLength: 2,
    maxLength: 120,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 120)
  contactName?: string;

  @ApiPropertyOptional({ format: 'email', example: 'maria@amihan.example' })
  @Transform(normalizeEmail)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsEmail()
  @MaxLength(254)
  email?: string;

  @ApiPropertyOptional({
    example: '+63 917 123 4567',
    minLength: 7,
    maxLength: 25,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Matches(/^\+?[0-9][0-9 ()-]{6,24}$/, {
    message: 'phone must be a valid telephone number',
  })
  phone?: string;
}
