import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrganizationPageQueryDto } from '../../dto/page-query.dto';

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ListInvitationsQueryDto extends OrganizationPageQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive invited email search',
    maxLength: 254,
  })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;

  @ApiPropertyOptional({ enum: ['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'] })
  @IsOptional()
  @IsIn(['PENDING', 'ACCEPTED', 'REVOKED', 'EXPIRED'])
  status?: 'PENDING' | 'ACCEPTED' | 'REVOKED' | 'EXPIRED';
}
