import mongoose, { Schema, Document, Model } from 'mongoose';
import type { Invoice } from '../types/billing';

export interface InvoiceDocument extends Document {
  id: string;
  _id: mongoose.Types.ObjectId;
}

const InvoiceSchema = new Schema({
  id: { type: String, required: true },
  type: { type: String, enum: ['A', 'B', 'C', 'E'], required: true },
  number: { type: Number, required: true },
  date: { type: Date, required: true },
  customer: {
    name: { type: String, required: true },
    documentType: { type: String, required: true },
    documentNumber: { type: String, required: true },
    address: { type: String, required: true },
    email: { type: String }
  },
  items: [{
    description: { type: String, required: true },
    quantity: { type: Number, required: true },
    unitPrice: { type: Number, required: true },
    taxRate: { type: Number, required: true },
    subtotal: { type: Number, required: true },
    tax: { type: Number, required: true },
    total: { type: Number, required: true }
  }],
  subtotal: { type: Number, required: true },
  tax: { type: Number, required: true },
  total: { type: Number, required: true },
  status: { 
    type: String, 
    enum: ['draft', 'pending', 'approved', 'rejected'],
    required: true,
    default: 'draft'
  }
});

export const InvoiceModel = mongoose.model<InvoiceDocument>('Invoice', InvoiceSchema);