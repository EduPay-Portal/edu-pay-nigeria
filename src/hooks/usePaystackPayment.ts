import { useState } from 'react';
import { toast } from 'sonner';
import { env } from '@/lib/env';

interface PaystackConfig {
  email: string;
  amount: number;
  reference?: string;
  metadata?: Record<string, unknown>;
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

    const reference =
      config.reference || `LIVE_${Date.now()}_${Math.random().toString(36).slice(2, 11)}`;

    const handler = window.PaystackPop.setup({
      key: publicKey,
      email: config.email,
      amount: Math.round(config.amount * 100),
      currency: 'NGN',
      ref: reference,
      metadata: config.metadata ?? {},
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
