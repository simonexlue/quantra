export type StockFlag = 'ok' | 'low' | 'out';

// Submission log shaped from Firestore
export type InventorySubmissionLine = {
    itemId: string;
    qty: number;
    flag: StockFlag;
}

export type InventorySubmissionDoc = {
    locationId: string;
    userId: string;
    submittedAt: any;
    lines: InventorySubmissionLine[];
}

export type InventoryCountDoc = {
    itemId: string;
    qty: number;
    flag: StockFlag;
    locationId: string;
    updatedBy: string;
    updatedAt: any;
}