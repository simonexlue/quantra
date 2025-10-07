export type CatalogItem = {
    id: string;
    name: string;
    synonyms?: string[];
    defaultUnit?: string;
    suppliers?: string[];          // e.g., ["sysco","central"]
    supplierId?: string | string[];   //can be string or array
    primarySupplierId?: string;    // optional
}

export type Supplier = {
    id: string;
    name: string;
};

export type SupplierContact = {
    id: string;
    name: string;
    email: string;
    phone: string;
    role?: string;
    primary?: boolean;
}