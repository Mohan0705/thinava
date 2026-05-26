export const SUPPORT_PHONE = '919160776152'
export const SUPPORT_PHONE_DISPLAY = '+91 9160776152'
export const SUPPORT_TEL = `tel:+${SUPPORT_PHONE}`
export const SUPPORT_EMAIL = 'supportthinava@gmail.com'
export const SUPPORT_EMAIL_LINK = `mailto:${SUPPORT_EMAIL}`
export const SUPPORT_WHATSAPP_NUMBER = '919160776152'
export const SUPPORT_WHATSAPP_URL = `https://wa.me/${SUPPORT_WHATSAPP_NUMBER}`
export const SUPPORT_WHATSAPP_MESSAGE = 'Hi Thinava Support'
export const SUPPORT_WHATSAPP_LINK = `${SUPPORT_WHATSAPP_URL}?text=${encodeURIComponent(SUPPORT_WHATSAPP_MESSAGE)}`

export const getWhatsAppLink = (message?: string) => {
  const text = encodeURIComponent(message || SUPPORT_WHATSAPP_MESSAGE)
  return `${SUPPORT_WHATSAPP_URL}?text=${text}`
}
