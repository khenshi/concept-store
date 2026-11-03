import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { OrganizationPageQueryDto } from '../../dto/page-query.dto';

const trimOptional = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() || undefined : value;

export class ListMembersQueryDto extends OrganizationPageQueryDto {
  @ApiPropertyOptional({
    description: 'Case-insensitive first name, last name, or email search',
    maxLength: 254,
  })
  @Transform(trimOptional)
  @IsOptional()
  @IsString()
  @MaxLength(254)
  q?: string;
}
