'use client'

import Link from 'next/link';
import { useTranslations } from 'next-intl';

export function Footer() {
  const t = useTranslations();

  return (
    <footer className="mt-20 border-t border-white/70 bg-[rgba(27,49,40,0.95)] text-slate-200">
      <div className="app-container py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {/* Links Section */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-md tracking-wide">{t('footer.links')}</h3>
            <ul className="space-y-2">
              <li>
                <Link 
                  href="/help" 
                  className="hover:text-amber-300 transition-colors duration-200 text-sm"
                >
                  {t('footer.help')}
                </Link>
              </li>
              <li>
                <Link 
                  href="https://cofiblocks.com"
                  target="_blank"
                  className="hover:text-amber-300 transition-colors duration-200 text-sm"
                >
                  {t('footer.about')}
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact Section */}
          <div>
            <h3 className="text-white font-semibold mb-4 text-md">{t('footer.contact')}</h3>
            <p className="text-sm">
              <a 
                href="mailto:info@cofiblocks.com"
                className="hover:text-amber-300 transition-colors duration-200 text-sm"
              >
                info@cofiblocks.com
              </a>
            </p>
          </div>

          {/* Trademark Section */}
          <div className="md:text-right">
            <p className="text-sm text-slate-300/80">
              {t('footer.trademark')}
            </p>
          </div>
        </div>
      </div>
    </footer>
  );
}
