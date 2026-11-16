import { Prisma } from '../../../generated/prisma/client';
/** Current configured equivalent, rounded to kobo only for display. */
export function pointsValueNaira(
  points: Prisma.Decimal,
  rate: Prisma.Decimal | null | undefined,
) {
  return rate && rate.gte(0)
    ? points.mul(rate).toFixed(2, Prisma.Decimal.ROUND_HALF_UP)
    : null;
}
