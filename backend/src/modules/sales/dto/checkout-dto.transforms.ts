import type { TransformFnParams } from 'class-transformer';

export function trimOptionalReference({ value }: TransformFnParams): unknown {
  if (typeof value !== 'string') return value;
  return value.trim() || undefined;
}
