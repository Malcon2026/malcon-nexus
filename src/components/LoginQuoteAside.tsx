import React, { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { LOGIN_QUOTES } from '../constants/loginQuotes';
import { PoweredByAiBadge } from './PoweredByAiBadge';

const ROTATE_MS = 9000;

export const LoginQuoteAside: React.FC<{ className?: string }> = ({ className = '' }) => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LOGIN_QUOTES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const quote = LOGIN_QUOTES[index];

  return (
    <aside
      className={`nexus-login-aside flex flex-col justify-between ${className}`}
      aria-label="Malcon Nexus"
    >
      <div className="nexus-login-aside-top">
        <p className="nexus-login-aside-eyebrow">Malcon Nexus</p>
        <p className="nexus-login-aside-tagline">Malcon Life Sciences</p>
      </div>

      <div className="nexus-login-quote-block min-h-[12rem] flex flex-col justify-center">
        <span className="nexus-login-quote-mark" aria-hidden>
          &ldquo;
        </span>
        <AnimatePresence mode="wait">
          <motion.div
            key={index}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.35 }}
          >
            <blockquote className="nexus-login-quote-text">{quote.text}</blockquote>
            <p className="nexus-login-quote-attribution mt-4">{quote.attribution}</p>
          </motion.div>
        </AnimatePresence>

        <div className="flex items-center gap-2 mt-8" role="tablist" aria-label="Quote rotation">
          {LOGIN_QUOTES.map((_, i) => (
            <button
              key={i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Quote ${i + 1} of ${LOGIN_QUOTES.length}`}
              onClick={() => setIndex(i)}
              className={`nexus-login-quote-dot ${i === index ? 'is-active' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="nexus-login-aside-foot">
        <PoweredByAiBadge variant="pill" />
      </div>
    </aside>
  );
};

/** Compact quote for mobile — single line from current rotation. */
export const LoginQuoteMobile: React.FC = () => {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % LOGIN_QUOTES.length);
    }, ROTATE_MS);
    return () => window.clearInterval(id);
  }, []);

  const quote = LOGIN_QUOTES[index];

  return (
    <div className="lg:hidden nexus-login-mobile-quote mb-8 px-1">
      <p className="nexus-login-quote-text text-[1.125rem] leading-snug">{quote.text}</p>
      <p className="nexus-login-quote-attribution mt-2 text-[11px]">{quote.attribution}</p>
    </div>
  );
};
