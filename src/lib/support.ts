export const SUPPORT_PHONE = '9160776152'
export const SUPPORT_PHONE_DISPLAY = '+91 91607 76152'
export const SUPPORT_TEL = `tel:${SUPPORT_PHONE}`
export const SUPPORT_EMAIL = 'support@thinava.com'
export const SUPPORT_WHATSAPP_NUMBER = '919160776152'
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`
export const SUPPORT_WHATSAPP_MESSAGE = `Hi%20Thinava%20Support`
export const SUPPORT_WHATSAPP_LINK = `${SUPPORT_WHATSAPP_URL}?text=${SUPPORT_WHATSAPP_MESSAGE}`

export const getWhatsAppLink = (message?: string) => {
  const text = message ? encodeURIComponent(message) : SUPPORT_WHATSAPP_MESSAGE
  return `${SUPPORT_WHATSAPP_URL}?text=${text}`
}
