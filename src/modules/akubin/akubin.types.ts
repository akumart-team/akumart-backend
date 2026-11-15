import type { Request } from 'express';
import type { Prisma } from '../../generated/prisma/client';
export type AkubinTransaction = Prisma.TransactionClient;
export type AkubinRequest = Request & {
  user: { id: string };
  accessToken: string;
};

export const PUBLIC_BIN_SELECT = {
  id: true,
  code: true,
  name: true,
  city: true,
  area: true,
  landmark: true,
  latitude: true,
  longitude: true,
  materials: true,
  status: true,
  capacityPct: true,
  hours: true,
  nextCollectionAt: true,
  lastSeenAt: true,
} satisfies Prisma.BinSelect;

export function pageArgs(query: { page: number; limit: number }) {
  return { skip: (query.page - 1) * query.limit, take: query.limit };
}

export function paginated<T>(
  data: T[],
  total: number,
  query: { page: number; limit: number },
) {
  return { data, pagination: { page: query.page, limit: query.limit, total } };
}
