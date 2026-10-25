import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { IsNewPassword } from './new-password';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({
    format: 'password',
    minLength: 12,
    maxLength: 72,
    description: 'At most 72 UTF-8 bytes',
  })
  @IsString()
  @IsNewPassword()
  newPassword!: string;
}
