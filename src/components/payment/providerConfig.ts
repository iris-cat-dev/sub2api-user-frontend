export const METHOD_ORDER = ['alipay', 'alipay_direct', 'wxpay', 'wxpay_direct', 'stripe', 'airwallex'] as const

export function isBuiltInAlipayMethod(type: string): boolean {
  return type === 'alipay' || type === 'alipay_direct'
}

export function isBuiltInWxpayMethod(type: string): boolean {
  return type === 'wxpay' || type === 'wxpay_direct'
}

const PAYMENT_POPUP_PREFERRED_WIDTH = 1250
const PAYMENT_POPUP_PREFERRED_HEIGHT = 900

export function getPaymentPopupFeatures(): string {
  const screen = typeof window !== 'undefined' ? window.screen : null
  const availableWidth = screen?.availWidth ?? PAYMENT_POPUP_PREFERRED_WIDTH
  const availableHeight = screen?.availHeight ?? PAYMENT_POPUP_PREFERRED_HEIGHT
  const width = Math.min(PAYMENT_POPUP_PREFERRED_WIDTH, availableWidth - 40)
  const height = Math.min(PAYMENT_POPUP_PREFERRED_HEIGHT, availableHeight - 40)
  const left = Math.max(0, Math.floor((availableWidth - width) / 2))
  const top = Math.max(0, Math.floor((availableHeight - height) / 2))

  return `width=${width},height=${height},left=${left},top=${top},scrollbars=yes,resizable=yes`
}
