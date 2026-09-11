import { Transform } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEmail,
  IsOptional,
  IsPhoneNumber,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import {
  normalizeOptionalCode,
  normalizeOptionalEmail,
  trimRequiredString,
} from './merchant-dto.transforms';

export class CreateMerchantDto {
  @ApiProperty({ example: 'Amihan Home Studio', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ example: 'AMIHAN-HOME', minLength: 2, maxLength: 32 })
  @Transform(normalizeOptionalCode)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  code?: string;

  @ApiProperty({ example: 'Mara Santos', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  contactName!: string;

  @ApiPropertyOptional({ example: 'mara@amihan.example.com', maxLength: 254 })
  @Transform(normalizeOptionalEmail)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  @IsEmail()
  email?: string;

  @ApiProperty({ example: '+63 917 555 0101', minLength: 7, maxLength: 30 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(7, 30)
  @IsPhoneNumber('PH', {
    message: 'phone must be a valid Philippine mobile or telephone number',
  })
  phone!: string;
}
