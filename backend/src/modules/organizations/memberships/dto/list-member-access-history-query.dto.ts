import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';
import { OrganizationPageQueryDto } from '../../dto/page-query.dto';

export class ListMemberAccessHistoryQueryDto extends OrganizationPageQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @Type(() => String)
  @IsUUID('4')
  userId?: string;
}
