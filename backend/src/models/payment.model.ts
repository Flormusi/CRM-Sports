import mongoose, { Schema, Document } from 'mongoose';

export interface IPayment extends Document {
  invoiceId: string;
  amount: number;
  date: Date;
  method: 'cash' | 'transfer' | 'credit_card' | 'debit_card';
  notes?: string;
  status: 'pending' | 'completed' | 'failed';
  transactionId?: string;
}

const PaymentSchema = new Schema({
  invoiceId: {
    type: String,
    required: true,
    ref: 'Invoice'
  },
  amount: {
    type: Number,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  method: {
    type: String,
    enum: ['cash', 'transfer', 'credit_card', 'debit_card'],
    required: true
  },
  notes: {
    type: String
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed'],
    default: 'completed'
  },
  transactionId: {
    type: String
  }
}, {
  timestamps: true
});

export const Payment = mongoose.model<IPayment>('Payment', PaymentSchema);