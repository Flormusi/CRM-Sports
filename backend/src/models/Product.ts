import mongoose, { Schema, Document } from 'mongoose';

export interface IProduct extends Document {
  name: string;
  sku: string;
  description: string;
  price: number;
  stock: number;
  minStock: number;
  category: {
    id: string;
    name: string;
    description: string;
  };
  images: string[];
  status: 'active' | 'inactive';
  createdAt: Date;
  updatedAt: Date;
}

const ProductSchema = new Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  sku: { 
    type: String, 
    required: true, 
    unique: true,
    trim: true
  },
  description: { 
    type: String,
    trim: true
  },
  price: { 
    type: Number, 
    required: true,
    min: 0
  },
  stock: { 
    type: Number, 
    default: 0,
    min: 0
  },
  minStock: { 
    type: Number, 
    default: 5,
    min: 0
  },
  category: {
    id: String,
    name: String,
    description: String
  },
  images: [String],
  status: { 
    type: String, 
    enum: ['active', 'inactive'], 
    default: 'active' 
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes for better query performance
ProductSchema.index({ sku: 1 }, { unique: true });
ProductSchema.index({ status: 1 });
ProductSchema.index({ name: 1 });
ProductSchema.index({ 'category.name': 1 });

export const Product = mongoose.model<IProduct>('Product', ProductSchema);