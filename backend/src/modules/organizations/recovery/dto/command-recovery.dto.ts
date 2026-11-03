import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import {
  CommandRecoveryKind,
  CommandRecoveryState,
} from '../../../../generated/prisma/client';

const lowerUuid = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.toLowerCase() : value;

export class PrepareCommandRecoveryDto {
  @ApiProperty({ enum: CommandRecoveryKind })
  @IsEnum(CommandRecoveryKind)
  kind!: CommandRecoveryKind;

  @ApiProperty({ format: 'uuid' })
  @Transform(lowerUuid)
  @IsUUID('4')
  branchId!: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @Transform(lowerUuid)
  @IsOptional()
  @IsUUID('4')
  saleId?: string;

  @ApiProperty({ type: Object })
  @IsObject()
  command!: Record<string, unknown>;
}

export class CommandRecoveryQueryDto {
  @ApiPropertyOptional({ enum: CommandRecoveryKind })
  @IsOptional()
  @IsEnum(CommandRecoveryKind)
  kind?: CommandRecoveryKind;
}

export class CommandRecoveryResponseDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ enum: CommandRecoveryKind })
  kind!: CommandRecoveryKind;

  @ApiProperty({ enum: CommandRecoveryState })
  state!: CommandRecoveryState;

  @ApiProperty({ format: 'uuid' })
  requestId!: string;

  @ApiProperty({ format: 'uuid' })
  branchId!: string;

  @ApiProperty({ format: 'uuid', nullable: true })
  saleId!: string | null;

  @ApiProperty({ type: Object })
  command!: Record<string, unknown>;

  @ApiProperty({ format: 'uuid', nullable: true })
  sourceId!: string | null;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: Date;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  submittedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  completedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  acknowledgedAt!: Date | null;

  @ApiProperty({ type: String, format: 'date-time', nullable: true })
  closedAt!: Date | null;

  @ApiProperty({ type: Object, nullable: true })
  result!: Record<string, unknown> | null;
}
