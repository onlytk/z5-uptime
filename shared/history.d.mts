export declare const LEVELS: readonly ["up", "degraded", "down", "unknown"];
export declare const STATS: readonly ["ms", "avgMs", "blocks", "fastBlocks", "blockMs", "fastConfirmMs", "confirmMs", "deliverySeconds"];
export declare const MAX_SERIES: number;
export declare function isPoint(point: unknown): boolean;
export declare function isPart(part: unknown): boolean;
export declare function isHistory(history: unknown): boolean;
