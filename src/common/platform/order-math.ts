import { Prisma } from '../../generated/prisma/client';
import type { QuantityUnit } from '../../generated/prisma/enums';
export const kilograms = (quantity: Prisma.Decimal, unit: QuantityUnit) =>
  unit === 'tonne' ? quantity.mul(1000) : quantity;
export function fareEstimate(
  kg: Prisma.Decimal,
  settings: {
    fareBase: Prisma.Decimal;
    farePerKg: Prisma.Decimal;
    fareStep: Prisma.Decimal;
    fareMinPct: Prisma.Decimal;
    fareMaxPct: Prisma.Decimal;
  },
) {
  const round = (value: Prisma.Decimal) =>
    value
      .div(settings.fareStep)
      .toDecimalPlaces(0)
      .mul(settings.fareStep)
      .toDecimalPlaces(2);
  const recommendedFare = round(
    settings.fareBase.add(settings.farePerKg.mul(kg)),
  );
  return {
    recommendedFare,
    minFare: round(
      recommendedFare
        .mul(new Prisma.Decimal(100).sub(settings.fareMinPct))
        .div(100),
    ),
    maxFare: round(
      recommendedFare
        .mul(new Prisma.Decimal(100).add(settings.fareMaxPct))
        .div(100),
    ),
    step: settings.fareStep,
  };
}
