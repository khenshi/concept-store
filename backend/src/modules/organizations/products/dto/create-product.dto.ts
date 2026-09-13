import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsOptional,
  IsString,
  IsUUID,
  Length,
  Matches,
  IsObject,
  ValidateIf,
  ValidateNested,
  Validate,
  ValidatorConstraint,
  ValidatorConstraintInterface,
  ValidationArguments,
} from 'class-validator';
import { ProductOpeningInventoryDto } from './product-opening-inventory.dto';
import {
  normalizeOptionalSku,
  trimOptionalString,
  trimRequiredString,
} from './product-dto.transforms';

@ValidatorConstraint({ name: 'openingStockRequestPair', async: false })
class OpeningStockRequestPair implements ValidatorConstraintInterface {
  validate(_value: unknown, args: ValidationArguments): boolean {
    return (args.object as CreateProductDto).initialInventory !== undefined;
  }

  defaultMessage(): string {
    return 'requestId requires initialInventory';
  }
}

export class CreateProductDto {
  @ApiPropertyOptional({
    type: ProductOpeningInventoryDto,
    description:
      'Optional opening stock; requires requestId. Omit for product-only creation.',
  })
  @ValidateIf(
    (_object: CreateProductDto, value: unknown) => value !== undefined,
  )
  @IsObject()
  @ValidateNested()
  @Type(() => ProductOpeningInventoryDto)
  initialInventory?: ProductOpeningInventoryDto;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Required only with initialInventory; retain for same-command retry.',
  })
  @ValidateIf(
    (object: CreateProductDto, value: unknown) =>
      object.initialInventory !== undefined || value !== undefined,
  )
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.toLowerCase() : value,
  )
  @IsUUID('4')
  @Validate(OpeningStockRequestPair)
  requestId?: string;
  @ApiProperty({
    format: 'uuid',
    description:
      'Active merchant in this organization; ownership cannot be reassigned',
  })
  @IsUUID('4')
  merchantId!: string;

  @ApiProperty({ example: 'Amihan Ceramic Vase', minLength: 2, maxLength: 120 })
  @Transform(trimRequiredString)
  @IsString()
  @Length(2, 120)
  name!: string;

  @ApiPropertyOptional({ example: 'AMIHAN-VASE', minLength: 2, maxLength: 32 })
  @Transform(normalizeOptionalSku)
  @IsOptional()
  @IsString()
  @Length(2, 32)
  @Matches(/^[A-Z0-9]+(?:-[A-Z0-9]+)*$/)
  sku?: string | null;

  @ApiPropertyOptional({
    example: '0001234567890',
    minLength: 1,
    maxLength: 64,
  })
  @Transform(trimOptionalString)
  @IsOptional()
  @IsString()
  @Length(1, 64)
  @Matches(/^[A-Za-z0-9-]+$/)
  barcode?: string | null;
}
