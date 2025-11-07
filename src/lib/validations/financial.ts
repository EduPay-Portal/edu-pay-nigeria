import { z } from 'zod';

/**
 * Financial validation schemas with strict rules for amounts and transactions
 */

// Amount validation with precision control
const amountSchema = z
  .number()
  .positive('Amount must be positive')
  .max(10000000, 'Amount exceeds maximum limit of ₦10,000,000')
  .refine(
    (val) => {
      const str = val.toString();
      const decimalIndex = str.indexOf('.');
      return decimalIndex === -1 || str.length - decimalIndex - 1 <= 2;
    },
    {
      message: 'Amount must have at most 2 decimal places',
    }
  );

// Transaction validation
export const transactionSchema = z.object({
  amount: amountSchema,
  type: z.enum(['credit', 'debit'], {
    required_error: 'Transaction type is required',
  }),
  category: z.enum(
    ['fee_payment', 'wallet_topup', 'canteen', 'books', 'transport', 'other'],
    {
      required_error: 'Transaction category is required',
    }
  ),
  description: z
    .string()
    .max(500, 'Description must be less than 500 characters')
    .optional()
    .transform((val) => val?.trim()),
  metadata: z.record(z.any()).optional(),
  idempotencyKey: z.string().uuid('Invalid idempotency key'),
});

// Wallet top-up validation
export const walletTopUpSchema = z.object({
  amount: amountSchema,
  paymentMethod: z.enum(['card', 'bank_transfer', 'ussd'], {
    required_error: 'Payment method is required',
  }),
  reference: z.string().min(1, 'Payment reference is required'),
});

// Balance update validation (admin operations)
export const balanceUpdateSchema = z.object({
  walletId: z.string().uuid('Invalid wallet ID'),
  amount: amountSchema,
  operation: z.enum(['add', 'subtract'], {
    required_error: 'Operation type is required',
  }),
  reason: z
    .string()
    .min(10, 'Reason for balance update must be at least 10 characters')
    .max(500, 'Reason must be less than 500 characters'),
});

// Fee payment validation
export const feePaymentSchema = z.object({
  studentId: z.string().uuid('Invalid student ID'),
  amount: amountSchema,
  feeType: z.string().min(1, 'Fee type is required'),
  term: z.string().optional(),
  academicYear: z.string().optional(),
});

export type TransactionInput = z.infer<typeof transactionSchema>;
export type WalletTopUpInput = z.infer<typeof walletTopUpSchema>;
export type BalanceUpdateInput = z.infer<typeof balanceUpdateSchema>;
export type FeePaymentInput = z.infer<typeof feePaymentSchema>;
