export interface Wallet {
  id: string;
  user_id: string;
  balance: number;
  currency: string;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  wallet_id: string;
  type: 'credit' | 'debit';
  amount: number;
  category: 'fee_payment' | 'wallet_topup' | 'canteen' | 'books' | 'transport' | 'other';
  description: string | null;
  reference: string;
  status: 'pending' | 'completed' | 'failed' | 'reversed';
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface StudentProfile {
  id: string;
  user_id: string;
  admission_number: string;
  class_level: string;
  section: string | null;
  parent_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ParentProfile {
  id: string;
  user_id: string;
  occupation: string | null;
  notification_preference: 'sms' | 'email' | 'both';
  emergency_contact: string | null;
  created_at: string;
  updated_at: string;
}

export interface AdminProfile {
  id: string;
  user_id: string;
  department: string | null;
  access_level: number;
  created_at: string;
  updated_at: string;
}
