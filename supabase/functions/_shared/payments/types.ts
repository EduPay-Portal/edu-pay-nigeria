// Provider-agnostic payment types.
// Wema Bank is the active provider. Under the Wema VAS model the VENDOR (this
// app) generates its own virtual account numbers — there is no remote account
// creation API — and hosts the endpoints the bank calls.

export type ProviderName = "wema";
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
  /** Pre-allocated NUBAN (prefix + 7-digit serial) from the database allocator. */
  account_number: string;
}

export interface NormalizedTransaction {
  provider: ProviderName;
  provider_reference: string;
  session_id?: string;
  amount: number; // major units (NGN)
  currency: string;
  status: "pending" | "completed" | "failed";
  paid_at?: string;
  account_number?: string; // destination virtual account (craccount)
  payer_account_name?: string;
  payer_account_number?: string;
  payer_bank?: string;
  raw: Record<string, unknown>;
}

export interface DVAProvider {
  readonly name: ProviderName;
  readonly environment: Environment;
  /** Builds the virtual account record for a pre-allocated account number. */
  createDVA(input: CreateDVAInput): Promise<DVAccount>;
}
