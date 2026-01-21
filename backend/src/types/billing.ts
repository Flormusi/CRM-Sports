export interface Invoice {
  id: string;
  type: 'A' | 'B' | 'C' | 'E';
  number: number;
  date: Date;
  customer: {
    name: string;
    documentType: 'CUIT' | 'CUIL' | 'DNI';
    documentNumber: string;
    address: string;
    email?: string;
  };
  items: {
    description: string;
    quantity: number;
    unitPrice: number;
    taxRate: number;
    subtotal: number;
    tax: number;
    total: number;
  }[];
  subtotal: number;
  tax: number;
  total: number;
  status: 'draft' | 'pending' | 'approved' | 'rejected';
}