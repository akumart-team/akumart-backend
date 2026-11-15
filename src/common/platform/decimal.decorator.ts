import { Transform } from 'class-transformer';
import { Matches } from 'class-validator';
import { applyDecorators } from '@nestjs/common';
export const DecimalField = (scale = 2) =>
  applyDecorators(
    Transform(({ value }) =>
      typeof value === 'number' ? String(value) : value,
    ),
    Matches(new RegExp(`^(?:0|[1-9]\\d{0,11})(?:\\.\\d{1,${scale}})?$`), {
      message: `Must be a nonnegative decimal with at most ${scale} decimal places`,
    }),
  );
