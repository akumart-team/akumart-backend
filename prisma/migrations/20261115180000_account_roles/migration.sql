-- Extend preferences without reclassifying existing accounts or changing staff access.
ALTER TYPE public."MarketRole" ADD VALUE IF NOT EXISTS 'logistics';
ALTER TYPE public."MarketRole" ADD VALUE IF NOT EXISTS 'recycler';
