import { Schema, model } from 'mongoose';

const invoiceSchema = new Schema({
  id: { type: String, required: true, unique: true },
  type: { type: String, required: true },
  number: { type: Number, required: true, unique: true },
  date: { type: Date, required: true },
  customer: {
    id: { type: String, required: true },
    name: { type: String, required: true },
    email: { type: String, required: true }
  },
  items: [{
    description: String,
    quantity: Number,
    unitPrice: Number,
    taxRate: Number,
    subtotal: Number,
    tax: Number,
    total: Number
  }],
  subtotal: Number,
  tax: Number,
  total: Number,
  status: {
    type: String,
    enum: ['pending', 'paid', 'cancelled', 'completed'],
    default: 'pending'
  },
  paymentDetails: {
    method: {
      type: String,
      enum: ['cash', 'transfer', 'credit_card', 'debit_card'],
      required: function(this: any): boolean {
        return this.status === 'paid';
      }
    },
    paidAt: {
      type: Date,
      required: function(this: any): boolean {
        return this.status === 'paid';
      }
    },
    transactionId: String,
    notes: String,
    partialPayments: [{
      amount: { type: Number, required: true },
      date: { type: Date, required: true },
      method: { 
        type: String, 
        enum: ['cash', 'transfer', 'credit_card', 'debit_card'],
        required: true 
      },
      notes: String
    }]
  },
  dueDate: {
    type: Date,
    required: true,
    validate: {
      validator: function(this: any, value: Date): boolean {
        return value > this.date;
      },
      message: 'Due date must be after invoice date'
    }
  },
  remindersSent: [{
    date: { type: Date, required: true },
    type: { type: String, enum: ['email', 'sms'], required: true },
    status: { type: String, enum: ['sent', 'failed'], required: true }
  }],
  pdfGenerated: {
    lastGenerated: Date,
    url: String,
    version: { type: Number, default: 1 }
  },
  cancellationReason: {
    type: String,
    trim: true,
    validate: {
      validator: function(value: string) {
        if (this.status !== 'cancelled') return true;
        if (!value) return false;
        const trimmedLength = value.trim().length;
        return trimmedLength >= 10 && trimmedLength <= 500;
      },
      message: function(props) {
        if (!props.value) return 'Cancellation reason is required when cancelling an invoice';
        if (props.value.trim().length < 10) return 'Cancellation reason must be at least 10 characters long';
        if (props.value.trim().length > 500) return 'Cancellation reason cannot exceed 500 characters';
        return 'Invalid cancellation reason';
      }
    }
  },
  cancelledAt: {
    type: Date,
    default: null,
    validate: {
      validator: function(this: any, value: Date | null): boolean {
        if (this.status === 'cancelled') {
          return value instanceof Date;
        }
        return value === null;
      },
      message: function(this: any): string {
        return this.status === 'cancelled' 
          ? 'Cancellation date is required when invoice is cancelled' 
          : 'Cancellation date must be null when invoice is not cancelled';
      }
    }
  }
}, {
    
  timestamps: true
});

export const InvoiceModel = model('Invoice', invoiceSchema);