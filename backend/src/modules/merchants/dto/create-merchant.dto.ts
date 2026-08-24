import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  normalizeEmail,
  normalizeOptionalCode,
  trimRequiredString,
} from './merchant-dto.transforms';

export class CreateMerchantDto {
  @ApiProperty({ example: 'Amihan Goods', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ example: 'AMIHAN-01', minLength: 2, maxLength: 32 })
  @Transform(normalizeOptionalCode)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string;

  @ApiProperty({ example: 'Maria Santos', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  contactName!: string;

  @ApiProperty({ format: 'email', example: 'maria@amihan.example' })
  @Transform(normalizeEmail)
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @ApiProperty({ example: '+63 917 123 4567', minLength: 7, maxLength: 25 })
  @Transform(trimRequiredString)
  @IsString()
  @Matches(/^\+?[0-9][0-9 ()-]{6,24}$/, {
    message: 'phone must be a valid telephone number',
  })
  phone!: string;
}
