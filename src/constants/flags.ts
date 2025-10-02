// Thresholds for flags
import type { StockFlag } from '../types/inventory';

export function computeFlag(qty: number, opts?: { low?: number }): StockFlag {
    if (qty <= 0) return 'out';
    const low = typeof opts?.low === 'number' ? opts.low : 5; // default 5
    if (qty <= low) return 'low';
    return 'ok';
  }