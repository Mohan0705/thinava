import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import MobileNav from '@/components/layout/MobileNav'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'

type InfoSection = {
  title: string
  body?: string
  items?: string[]
}

type FaqItem = {
  question: string
  answer: string
}

type StaticInfoPageProps = {
  eyebrow: string
  title: string
  description: string
  sections?: InfoSection[]
  faqItems?: FaqItem[]
  cta?: {
    title: string
    description: string
    primaryLabel: string
    primaryHref: string
    secondaryLabel?: string
    secondaryHref?: string
  }
}

export function StaticInfoPage({
  eyebrow,
  title,
  description,
  sections = [],
  faqItems = [],
  cta,
}: StaticInfoPageProps) {
  return (
    <div className="min-h-screen bg-[#FFF8F4] pb-20 md:pb-0">
      <Header />
      <main>
        <section className="border-b border-orange-100 bg-white">
          <div className="container mx-auto px-4 py-12 sm:px-6 lg:px-8">
            <div className="max-w-3xl">
              <div className="inline-flex rounded-full bg-orange-50 px-3 py-1 text-xs font-black uppercase tracking-[0.22em] text-thinava-primary">
                {eyebrow}
              </div>
              <h1 className="mt-4 text-3xl font-black tracking-tight text-slate-950 md:text-5xl">
                {title}
              </h1>
              <p className="mt-4 max-w-2xl text-base leading-7 text-slate-600 md:text-lg">
                {description}
              </p>
            </div>
          </div>
        </section>

        {sections.length > 0 ? (
          <section className="container mx-auto grid gap-4 px-4 py-10 sm:px-6 md:grid-cols-2 lg:px-8">
            {sections.map((section) => (
              <article key={section.title} className="rounded-2xl border border-orange-100 bg-white p-6 shadow-[0_18px_42px_-34px_rgba(15,23,42,0.35)]">
                <h2 className="text-xl font-black text-slate-950">{section.title}</h2>
                {section.body ? <p className="mt-3 text-sm leading-6 text-slate-600">{section.body}</p> : null}
                {section.items ? (
                  <ul className="mt-4 space-y-3">
                    {section.items.map((item) => (
                      <li key={item} className="flex gap-2.5 text-sm font-medium leading-6 text-slate-700">
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-thinava-primary" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </article>
            ))}
          </section>
        ) : null}

        {faqItems.length > 0 ? (
          <section className="container mx-auto px-4 pb-10 sm:px-6 lg:px-8">
            <div className="mx-auto max-w-3xl space-y-3">
              {faqItems.map((item, index) => (
                <details
                  key={item.question}
                  className={cn(
                    'group rounded-2xl border border-orange-100 bg-white px-5 py-4 shadow-[0_18px_42px_-36px_rgba(15,23,42,0.32)]',
                    index === 0 && 'open:bg-white'
                  )}
                  open={index === 0}
                >
                  <summary className="cursor-pointer list-none text-base font-black text-slate-950">
                    {item.question}
                  </summary>
                  <p className="mt-3 text-sm leading-6 text-slate-600">{item.answer}</p>
                </details>
              ))}
            </div>
          </section>
        ) : null}

        {cta ? (
          <section className="container mx-auto px-4 pb-12 sm:px-6 lg:px-8">
            <div className="rounded-3xl bg-slate-950 px-6 py-8 text-white md:flex md:items-center md:justify-between md:gap-6">
              <div>
                <h2 className="text-2xl font-black">{cta.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-300">{cta.description}</p>
              </div>
              <div className="mt-5 flex flex-wrap gap-3 md:mt-0">
                <Link href={cta.primaryHref}>
                  <Button className="bg-thinava-primary hover:bg-thinava-primary/90">
                    {cta.primaryLabel}
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                {cta.secondaryHref && cta.secondaryLabel ? (
                  <Link href={cta.secondaryHref}>
                    <Button variant="outline" className="border-white/25 bg-transparent text-white hover:bg-white/10">
                      {cta.secondaryLabel}
                    </Button>
                  </Link>
                ) : null}
              </div>
            </div>
          </section>
        ) : null}
      </main>
      <Footer />
      <MobileNav />
    </div>
  )
}
