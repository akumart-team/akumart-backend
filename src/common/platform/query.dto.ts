import { Type } from 'class-transformer';
import {
  IsInt,
  IsIn,
  IsUUID,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
export class PageQuery {
  @ApiPropertyOptional({ type: Number, default: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(1000000)
  page: number = 1;
  @ApiPropertyOptional({ type: Number, default: 20 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit: number = 20;
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
export class TradeListQuery extends PageQuery {
  @ApiPropertyOptional({ enum: ['buyer', 'seller'] })
  @IsOptional()
  @IsIn(['buyer', 'seller'])
  mode?: 'buyer' | 'seller';
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  listingId?: string;
}
export const paging = (q: PageQuery) => ({
  skip: (q.page - 1) * q.limit,
  take: q.limit,
});
export const list = <T>(data: T[], total: number, q: PageQuery) => ({
  data,
  pagination: { page: q.page, limit: q.limit, total },
});
