import { paymentsApi } from '../services/api';

export function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export class CheckoutClosed extends Error {
  orderId: string;
  constructor(orderId: string) {
    super('The secure payment window was closed before the payment was confirmed.');
    this.name = 'CheckoutClosed';
    this.orderId = orderId;
  }
}

export function paymentFailureReason(err: any) {
  if (err instanceof CheckoutClosed) return err.message;
  return err?.response?.data?.message || err?.response?.data?.error || err?.message || 'The bank did not confirm this payment.';
}

export function openSecureCheckout(options: {
  orderId: string;
  amount: number;
  currency: string;
  keyId?: string;
  description: string;
  prefill: { name?: string; email?: string; contact?: string };
}) {
  return new Promise<void>((resolve, reject) => {
    const checkout = new (window as any).Razorpay({
      key: options.keyId,
      amount: options.amount,
      currency: options.currency,
      name: 'HeyStudent',
      description: options.description,
      order_id: options.orderId,
      prefill: options.prefill,
      theme: { color: '#111827' },
      retry: { enabled: true },
      modal: {
        confirm_close: true,
        backdropclose: false,
        escape: false,
        ondismiss: () => {
          paymentsApi.cancelCheckout(options.orderId).catch(() => {});
          reject(new CheckoutClosed(options.orderId));
        },
      },
      handler: async (response: any) => {
        try {
          await paymentsApi.verifyPayment({
            razorpayOrderId: response.razorpay_order_id,
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          });
          resolve();
        } catch (err) {
          reject(err);
        }
      },
    });
    checkout.open();
  });
}
