import mongoose, { Schema, Document } from 'mongoose';

export interface ICustomer extends Document {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  status: 'active' | 'inactive';
  totalPurchases: number;
  lastPurchase?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const CustomerSchema = new Schema({
  firstName: { 
    type: String, 
    required: true,
    trim: true
  },
  lastName: { 
    type: String, 
    required: true,
    trim: true
  },
  email: { 
    type: String, 
    required: true, 
    unique: true,
    lowercase: true,
    trim: true
  },
  phone: { 
    type: String,
    trim: true
  },
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  },
  totalPurchases: { 
    type: Number, 
    default: 0 
  },
  lastPurchase: { 
    type: Date 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
CustomerSchema.index({ email: 1 }, { unique: true });
CustomerSchema.index({ status: 1 });
CustomerSchema.index({ lastName: 1, firstName: 1 });

export const Customer = mongoose.model<ICustomer>('Customer', CustomerSchema);