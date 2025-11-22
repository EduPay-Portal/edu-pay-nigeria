import { useState } from 'react';
import { toast } from 'sonner';
import { env } from '@/lib/env';

interface PaystackConfig {
  email: string;
  amount: number;
  reference?: string;
  onSuccess: (reference: string) => void;
  onClose: () => void;
}

declare global {
  interface Window {
    PaystackPop?: {
      setup: (config: any) => {
        openIframe: () => void;
      };
    };
  }
}

export function usePaystackPayment() {
  const [isProcessing, setIsProcessing] = useState(false);

  const initiatePayment = (config: PaystackConfig) => {
    if (!window.PaystackPop) {
      toast.error('Payment system not loaded. Please refresh the page.');
      return;
    }

    const publicKey = env.VITE_PAYSTACK_PUBLIC_KEY;
    if (!publicKey || publicKey.trim() === '') {
      toast.error('Payment configuration error. Please contact support.');
      console.error('Paystack public key not configured');
      return;
    }

    setIsProcessing(true);

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: config.email,
      amount: Math.round(config.amount * 100),
      currency: 'NGN',
      ref: config.reference || `txn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      onClose: () => {
        setIsProcessing(false);
        config.onClose();
      },
      callback: (response: any) => {
        setIsProcessing(false);
        config.onSuccess(response.reference);
      },
    });

    handler.openIframe();
  };

  return {
    initiatePayment,
    isProcessing,
  };
}
