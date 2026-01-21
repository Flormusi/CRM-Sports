import { InvoiceModel } from '../models/invoice.model';
import { ApiError } from '../utils/ApiError';
import { Types } from 'mongoose';
import { Payment } from '../models/payment.model';

interface PartialPayment {
  amount: number;
  date: Date;
  method: 'cash' | 'transfer' | 'credit_card' | 'debit_card';
  notes?: string;
}

export class PaymentService {
  async recordPayment(invoiceId: string, paymentData: {
    amount: number;
    method: 'cash' | 'transfer' | 'credit_card' | 'debit_card';
    notes?: string;
  }) {
    const invoice = await InvoiceModel.findOne({ id: invoiceId });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (!invoice.total) throw new ApiError(400, 'Invoice total is not set');
    
    const payment: PartialPayment = {
      amount: paymentData.amount,
      date: new Date(),
      method: paymentData.method,
      notes: paymentData.notes
    };

    // Initialize payment details if not exists
    if (!invoice.paymentDetails) {
      invoice.set('paymentDetails', {
        partialPayments: [],
        method: paymentData.method,
        paidAt: null,
        transactionId: null,
        notes: null
      });
    }

    // Add to partial payments using Mongoose array methods
    invoice.get('paymentDetails.partialPayments', Array).push(payment);

    // Check if fully paid
    const totalPaid = invoice.get('paymentDetails.partialPayments', Array)
      .reduce((sum: number, payment: PartialPayment) => sum + payment.amount, 0);

    if (totalPaid >= invoice.total) {
      invoice.status = 'paid';
      invoice.set('paymentDetails.paidAt', new Date());
      invoice.set('paymentDetails.method', paymentData.method);
    }

    await invoice.save();
    return invoice;
  }

  async getPaymentStatus(invoiceId: string) {
    const invoice = await InvoiceModel.findOne({ id: invoiceId });
    if (!invoice) throw new ApiError(404, 'Invoice not found');
    if (!invoice.total) throw new ApiError(400, 'Invoice total is not set');
    if (!invoice.paymentDetails) {
      return {
        invoiceTotal: invoice.total,
        totalPaid: 0,
        remaining: invoice.total,
        status: invoice.status,
        payments: []
      };
    }

    const totalPaid = invoice.get('paymentDetails.partialPayments', Array)
      .reduce((sum: number, payment: PartialPayment) => sum + payment.amount, 0);

    return {
      invoiceTotal: invoice.total,
      totalPaid,
      remaining: invoice.total - totalPaid,
      status: invoice.status,
      payments: invoice.get('paymentDetails.partialPayments', Array)
    };
  }

  async getPaymentsByInvoiceId(invoiceId: string) {
    const payments = await Payment.find({ invoiceId });
    return payments;
  }
}