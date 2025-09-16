// Thresholds for flags
import type { StockFlag } from '../types/inventory';

export function computeFlag(qty:number): StockFlag {
    if (qty <= 0) return 'out';
    if (qty <= 5) return 'low';
    return 'ok';
}