import type { TransformFnParams } from 'class-transformer';

export function trimOptionalDecimal({ value }: TransformFnParams): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
