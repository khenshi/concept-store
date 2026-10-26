import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsBoolean,
  IsEnum,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
} from 'class-validator';
import { PaymentAccountAssignmentMode } from '../../../generated/prisma/client';

export class CreatePaymentAccountDto {
  @ApiProperty({ minLength: 1, maxLength: 100 })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim() : value,
  )
  @IsString()
  @Length(1, 100)
  name!: string;
  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  enabled = true;
  @ApiPropertyOptional({ default: true })
  @IsBoolean()
  requiresReference = true;
  @ApiProperty({ enum: PaymentAccountAssignmentMode })
  @IsEnum(PaymentAccountAssignmentMode)
  assignmentMode!: PaymentAccountAssignmentMode;
  @ApiProperty({
    type: [String],
    description: 'Empty for ALL; at least one tenant branch for SELECTED',
  })
  @IsArray()
  @ArrayUnique()
  @ArrayMaxSize(10000)
  @IsUUID('4', { each: true })
  branchIds!: string[];
}
export class UpdatePaymentAccountDto extends CreatePaymentAccountDto {
  @ApiProperty({ minimum: 1 })
  @IsInt()
  @Min(1)
  @Max(2147483646)
  version!: number;
}
export enum PaymentAccountOperation {
  SALE = 'SALE',
  REFUND = 'REFUND',
}
export class BranchPaymentAccountsQueryDto {
  @ApiProperty({ enum: PaymentAccountOperation })
  @IsEnum(PaymentAccountOperation)
  operation!: PaymentAccountOperation;
  @ApiPropertyOptional({ type: Boolean, default: false })
  @Transform(({ value }: { value: unknown }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  history = false;
}
export class PaymentAccountResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty() organizationId!: string;
  @ApiProperty() name!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty({ enum: ['CASH'], nullable: true }) systemKey!: 'CASH' | null;
  @ApiProperty() requiresReference!: boolean;
  @ApiProperty({ enum: PaymentAccountAssignmentMode })
  assignmentMode!: PaymentAccountAssignmentMode;
  @ApiProperty() version!: number;
  @ApiProperty({ format: 'date-time' }) createdAt!: Date;
  @ApiProperty({ format: 'date-time' }) updatedAt!: Date;
  @ApiPropertyOptional({ type: [String] }) branchIds?: string[];
  @ApiPropertyOptional() available?: boolean;
}
