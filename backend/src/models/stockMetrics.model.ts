import mongoose, { Schema, Document } from 'mongoose';

export interface IStockMetrics extends Document {
  productId: string;
  meliId: string;
  date: Date;
  quantity: number;
  price: number;
  stockDelta: number;
  priceDelta: number;
}

const StockMetricsSchema = new Schema({
  productId: {
    type: String,
    required: true,
    index: true
  },
  meliId: {
    type: String,
    required: true
  },
  date: {
    type: Date,
    default: Date.now
  },
  quantity: {
    type: Number,
    required: true
  },
  price: {
    type: Number,
    required: true
  },
  stockDelta: {
    type: Number,
    required: true
  },
  priceDelta: {
    type: Number,
    required: true
  }
});

export const StockMetrics = mongoose.model<IStockMetrics>('StockMetrics', StockMetricsSchema);