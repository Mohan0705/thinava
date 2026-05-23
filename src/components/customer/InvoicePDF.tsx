'use client'

import { formatPrice } from '@/lib/utils'

interface InvoiceItem {
  id: string
  name?: string
  quantity: number
  price: number | string
}

interface InvoiceDetails {
  id: string
  restaurantName: string
  restaurantAddress?: string
  customerName: string
  customerPhone: string
  deliveryAddress: string
  paymentMethod: string
  paymentStatus: string
  createdAt: string
  subtotal: number
  deliveryFee: number
  tax: number
  discount: number
  total: number
  items: InvoiceItem[]
}

interface InvoicePDFProps {
  invoice: InvoiceDetails
}

export default function InvoicePDF({ invoice }: InvoicePDFProps) {
  const getPaymentLabel = () => {
    const isCod = invoice.paymentMethod?.toLowerCase() === 'cod'
    const status = invoice.paymentStatus || 'pending'

    if (isCod) {
      if (status === 'not_collected') return { label: 'NOT COLLECTED', color: 'text-red-500 dark:text-red-400' }
      if (status === 'cod_collected' || status === 'collected') return { label: 'COLLECTED', color: 'text-green-600 dark:text-green-400' }
      if (status === 'paid' || status === 'delivered') return { label: 'COLLECTED', color: 'text-green-600 dark:text-green-400' }
      return { label: 'PENDING', color: 'text-amber-500 dark:text-amber-400' }
    }

    if (status === 'refunded') return { label: 'REFUNDED', color: 'text-blue-500 dark:text-blue-400' }
    if (status === 'refund_processing') return { label: 'REFUND PROCESSING', color: 'text-amber-500 dark:text-amber-400' }
    if (status === 'paid') return { label: 'PAID', color: 'text-green-600 dark:text-green-400' }
    return { label: 'PENDING', color: 'text-amber-500 dark:text-amber-400' }
  }

  const paymentLabel = getPaymentLabel()

  return (
    <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-md select-none">
      {/* Invoice On-Screen Header */}
      <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-100 dark:border-slate-800 print:hidden">
        <h4 className="font-bold text-slate-800 dark:text-slate-100">Order Invoice</h4>
      </div>

      {/* Printable Invoice Container */}
      <div id={`invoice-${invoice.id}`} className="print-area p-1 text-slate-850 dark:text-slate-200 font-sans">
        {/* Print Only Header styles */}
        <style dangerouslySetInnerHTML={{
          __html: `
            @media print {
              body * {
                visibility: hidden;
              }
              #invoice-${invoice.id}, #invoice-${invoice.id} * {
                visibility: visible;
              }
              #invoice-${invoice.id} {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                background: white !important;
                color: black !important;
                padding: 20px !important;
              }
              .print\\:hidden {
                display: none !important;
              }
            }
          `
        }} />

        {/* Invoice Header */}
        <div className="flex justify-between items-start mb-6">
          <div>
            <h2 className="text-2xl font-black tracking-tight text-orange-500">THINAVA</h2>
            <p className="text-[10px] text-slate-400 dark:text-slate-500 font-semibold uppercase tracking-wider">Hyperlocal Food Delivery</p>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Tadepalligudem, AP</p>
          </div>
          <div className="text-right">
            <h3 className="text-sm font-bold text-slate-800 dark:text-slate-100 uppercase">Receipt</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">Order: #{invoice.id.slice(0, 8).toUpperCase()}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{new Date(invoice.createdAt).toLocaleString('en-IN')}</p>
          </div>
        </div>

        {/* Billing Information */}
        <div className="grid grid-cols-2 gap-6 mb-6 pb-6 border-b border-slate-100 dark:border-slate-800 text-xs">
          <div>
            <p className="font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">From</p>
            <p className="font-bold text-slate-800 dark:text-slate-100">{invoice.restaurantName}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{invoice.restaurantAddress || 'Tadepalligudem Kitchen Partner'}</p>
          </div>
          <div>
            <p className="font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider mb-1.5">Deliver To</p>
            <p className="font-bold text-slate-800 dark:text-slate-100">{invoice.customerName}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-1">{invoice.customerPhone}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-0.5">{invoice.deliveryAddress}</p>
          </div>
        </div>

        {/* Payment info details */}
        <div className="mb-6 text-xs bg-slate-50 dark:bg-slate-800/40 rounded-2xl p-4 flex justify-between">
          <div>
            <span className="text-slate-450 dark:text-slate-400 font-medium">Payment Mode: </span>
            <span className="font-bold text-slate-850 dark:text-slate-100 uppercase">{invoice.paymentMethod === 'cod' ? 'Cash on Delivery (COD)' : 'Online Payment'}</span>
          </div>
          <div>
            <span className="text-slate-450 dark:text-slate-400 font-medium">Status: </span>
            <span className={`font-bold uppercase ${paymentLabel.color}`}>{paymentLabel.label}</span>
          </div>
        </div>

        {/* Itemized Table */}
        <table className="w-full mb-6 text-xs text-left">
          <thead>
            <tr className="border-b border-slate-200 dark:border-slate-800 font-extrabold text-slate-400 dark:text-slate-500 uppercase tracking-wider">
              <th className="py-2.5">Item Description</th>
              <th className="py-2.5 text-center">Qty</th>
              <th className="py-2.5 text-right">Price</th>
              <th className="py-2.5 text-right">Total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 dark:divide-slate-800/50">
            {invoice.items.map((item) => (
              <tr key={item.id} className="text-slate-800 dark:text-slate-200">
                <td className="py-3 font-semibold">{item.name || 'Menu Item'}</td>
                <td className="py-3 text-center">{item.quantity}</td>
                <td className="py-3 text-right">{formatPrice(Number(item.price))}</td>
                <td className="py-3 text-right font-bold">{formatPrice(Number(item.price) * item.quantity)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals Summary */}
        <div className="flex justify-end text-xs">
          <div className="w-64 space-y-2 border-t border-slate-200 dark:border-slate-800 pt-3">
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Subtotal</span>
              <span>{formatPrice(invoice.subtotal)}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Delivery Fee</span>
              <span>{invoice.deliveryFee === 0 ? 'FREE' : formatPrice(invoice.deliveryFee)}</span>
            </div>
            <div className="flex justify-between text-slate-500 dark:text-slate-400">
              <span>Tax & Charges</span>
              <span>{formatPrice(invoice.tax)}</span>
            </div>
            {invoice.discount > 0 && (
              <div className="flex justify-between font-semibold text-emerald-600 dark:text-emerald-400">
                <span>Discount</span>
                <span>-{formatPrice(invoice.discount)}</span>
              </div>
            )}
            <div className="flex justify-between font-black text-sm text-slate-800 dark:text-slate-100 border-t border-slate-150 dark:border-slate-800 pt-2">
              <span>Grand Total</span>
              <span>{formatPrice(invoice.total)}</span>
            </div>
          </div>
        </div>

        {/* Invoice Footer Disclaimer */}
        <div className="mt-8 text-center text-[10px] text-slate-400 dark:text-slate-500 border-t border-dashed pt-4">
          <p>Thank you for ordering with Thinava Tadepalligudem!</p>
          <p className="mt-0.5">This is a computer-generated invoice receipt and does not require a physical signature.</p>
        </div>
      </div>
    </div>
  )
}
