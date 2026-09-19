import { C, col, nowISO } from '../store/db'

// Document: secrets/razorpay. Secrets are stored encrypted (see store/secrets.ts).

export interface PaymentConfigDoc {
  enabled: boolean
  keyId: string
  keySecretEnc: string | null
  keySecretLast4: string | null
  webhookSecretEnc: string | null
  updatedAt: string | null
  updatedBy: number | null
}

const ref = () => col(C.secrets).doc('razorpay')

export const paymentConfigRepo = {
  async get(): Promise<PaymentConfigDoc | null> {
    const snap = await ref().get()
    return snap.exists ? (snap.data() as PaymentConfigDoc) : null
  },

  save: (patch: Partial<PaymentConfigDoc>, userId: number) => ref().set({ ...patch, updatedAt: nowISO(), updatedBy: userId }, { merge: true }),
}
