import mongoose, { Schema, Document } from 'mongoose';

export interface IStock extends Document {
  productId: string;
  meliId: string;
  quantity: number;
  minThreshold: number;
  lastSync: Date;
  lastAlert: Date | null;
  price: number;
  status: 'active' | 'inactive';
}

const StockSchema = new Schema({
  productId: {
    type: String,
    required: true,
    unique: true
  },
  meliId: {
    type: String,
    required: true,
    unique: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0
  },
  minThreshold: {
    type: Number,
    required: true,
    default: 5
  },
  lastSync: {
    type: Date,
    default: Date.now
  },
  lastAlert: {
    type: Date,
    default: null
  },
  price: {
    type: Number,
    required: true
  },
  status: {
    type: String,
    enum: ['active', 'inactive'],
    default: 'active'
  }
}, {
  timestamps: true
});

export const Stock = mongoose.model<IStock>('Stock', StockSchema);