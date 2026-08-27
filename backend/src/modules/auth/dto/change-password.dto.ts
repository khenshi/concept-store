import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({ format: 'password', minLength: 1, maxLength: 128 })
  @IsString()
  @Length(1, 128)
  currentPassword!: string;

  @ApiProperty({ format: 'password', minLength: 12, maxLength: 128 })
  @IsString()
  @Length(12, 128)
  newPassword!: string;
}
