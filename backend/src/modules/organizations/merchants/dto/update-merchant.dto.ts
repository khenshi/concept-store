import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
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
  normalizeNullableCode,
  normalizeNullableEmail,
  trimRequiredString,
} from './merchant-dto.transforms';

export class UpdateMerchantDto {
  @ApiPropertyOptional({
    example: 'Amihan Home Studio',
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
    example: 'AMIHAN-HOME',
    minLength: 2,
    maxLength: 32,
  })
  @Transform(normalizeNullableCode)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string | null;

  @ApiPropertyOptional({ example: 'Mara Santos', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(2, 120)
  contactName?: string;

  @ApiPropertyOptional({
    nullable: true,
    example: 'mara@amihan.example.com',
    maxLength: 254,
  })
  @Transform(normalizeNullableEmail)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  @IsEmail()
  email?: string | null;

  @ApiPropertyOptional({
    example: '+63 917 555 0101',
    minLength: 7,
    maxLength: 30,
  })
  @Transform(trimRequiredString)
  @ValidateIf((_object, value: unknown) => value !== undefined)
  @IsString()
  @Length(7, 30)
  phone?: string;
}
