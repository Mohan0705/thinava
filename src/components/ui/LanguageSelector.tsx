'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Globe, Check } from 'lucide-react'
import { useTranslation, Language } from '@/lib/i18n'

export default function LanguageSelector() {
  const { language, setLanguage } = useTranslation()
  const [isOpen, setIsOpen] = useState(false)

  const toggleDropdown = () => setIsOpen(!isOpen)

  const selectLanguage = (lang: Language) => {
    setLanguage(lang)
    setIsOpen(false)
  }

  return (
    <div className="relative">
      <motion.button
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={toggleDropdown}
        className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-slate-200 dark:border-slate-700 bg-white/70 dark:bg-slate-800/70 backdrop-blur-md text-slate-700 dark:text-slate-200 text-sm font-medium shadow-sm hover:shadow-md transition-shadow duration-200"
        aria-expanded={isOpen}
        id="language-selector-btn"
      >
        <Globe className="w-4 h-4 text-orange-500" />
        <span>{language === 'en' ? 'English' : 'తెలుగు'}</span>
      </motion.button>

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop to close */}
            <div
              className="fixed inset-0 z-40"
              onClick={() => setIsOpen(false)}
            />
            
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 mt-2 w-36 rounded-2xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-xl z-50 overflow-hidden py-1"
            >
              <button
                onClick={() => selectLanguage('en')}
                className="flex items-center justify-between w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span>English</span>
                {language === 'en' && <Check className="w-4 h-4 text-orange-500" />}
              </button>
              <button
                onClick={() => selectLanguage('te')}
                className="flex items-center justify-between w-full px-4 py-2.5 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200 transition-colors"
              >
                <span>తెలుగు</span>
                {language === 'te' && <Check className="w-4 h-4 text-orange-500" />}
              </button>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  )
}
