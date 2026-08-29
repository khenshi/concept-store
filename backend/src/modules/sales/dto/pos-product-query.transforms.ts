export function trimOptionalSearch({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() || undefined : value;
}

export function trimRequiredCode({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}
