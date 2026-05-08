// Provider-agnostic payment types.
// Any new bank/aggregator (Wema, Zenith, GTB, Paystack, etc.) implements PaymentProvider.

export type ProviderName = "wema" | "paystack";
export type Environment = "sandbox" | "production";

export interface DVAccount {
  provider: ProviderName;
  account_number: string;
  account_name: string;
  bank_name: string;
  bank_code: string;
  provider_account_id?: string;
  provider_customer_id?: string;
  environment: Environment;
  metadata?: Record<string, unknown>;
}

export interface CreateDVAInput {
  student_id: string;
  first_name: string;
  last_name: string;
  email: string;
  phone?: string;
  bvn?: string;
}

export interface NormalizedTransaction {
  provider: ProviderName;
  provider_reference: string;
  amount: number; // major units (NGN)
  currency: string;
  status: "pending" | "completed" | "failed";
  paid_at?: string;
  account_number?: string; // destination DVA
  payer_account_name?: string;
  payer_account_number?: string;
  payer_bank?: string;
  raw: Record<string, unknown>;
}

export interface WebhookParseResult {
  valid: boolean;
  reason?: string;
  event_type?: string;
  transaction?: NormalizedTransaction;
}

export interface DVAProvider {
  readonly name: ProviderName;
  readonly environment: Environment;
  createDVA(input: CreateDVAInput): Promise<DVAccount>;
  verifyTransaction(reference: string): Promise<NormalizedTransaction | null>;
  parseWebhook(rawBody: string, headers: Record<string, string>, ip?: string): Promise<WebhookParseResult>;
}
