import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  Length,
  MaxLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNewPassword } from './new-password';

const TOKEN_LENGTH = 43;

export class AccountActionEmailDto {
  @ApiProperty({
    format: 'email',
    example: 'owner@example.com',
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}

export class VerifyEmailDto {
  @ApiProperty({ minLength: TOKEN_LENGTH, maxLength: TOKEN_LENGTH })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(TOKEN_LENGTH, TOKEN_LENGTH)
  token!: string;

  @ApiPropertyOptional({ format: 'password', minLength: 12, maxLength: 72 })
  @IsOptional()
  @IsString()
  @IsNewPassword()
  password?: string;
}

export class ConfirmPasswordResetDto {
  @ApiProperty({ minLength: TOKEN_LENGTH, maxLength: TOKEN_LENGTH })
  @IsString()
  @Length(TOKEN_LENGTH, TOKEN_LENGTH)
  token!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 72 })
  @IsString()
  @IsNewPassword()
  newPassword!: string;
}
