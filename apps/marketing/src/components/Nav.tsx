'use client';
import { AnimatePresence, motion } from 'framer-motion';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { products } from '@/lib/products';
import { links } from '@/lib/site';
import { Arrow } from './Arrow';
import { Icon } from './Icon';
import { Wordmark } from './Wordmark';

const pages = [
  ['/pricing', 'Pricing'],
  ['/help', 'Help'],
  ['/contact', 'Contact'],
] as const;

/** The top menu: Home, the Products menu, Pricing, Help and Contact; Menu on phones. */
export function Nav() {
  const path = usePathname();
  const [open, setOpen] = useState<'products' | 'phone' | null>(null);
  const root = useRef<HTMLDivElement>(null);
  useEffect(() => setOpen(null), [path]);
  useEffect(() => {
    const away = (event: MouseEvent) => {
      if (!root.current?.contains(event.target as Node)) setOpen(null);
    };
    const key = (event: KeyboardEvent) => event.key === 'Escape' && setOpen(null);
    document.addEventListener('click', away);
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('click', away);
      document.removeEventListener('keydown', key);
    };
  }, []);
  const toggle = (menu: 'products' | 'phone') => setOpen(open === menu ? null : menu);
  const current = (href: string) => (path === href ? 'page' : undefined);
  const menu = {
    initial: { opacity: 0, y: -8 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -6 },
  };
  return (
    <header className="nav">
      <div className="wrap" ref={root}>
        <Wordmark />
        <nav className="links" aria-label="Main">
          <Link href="/" aria-current={current('/')}>
            Home
          </Link>
          <button
            type="button"
            className={'menu-btn' + (path.startsWith('/products') ? ' on' : '')}
            aria-expanded={open === 'products'}
            aria-controls="products-menu"
            onClick={() => toggle('products')}
          >
            Products <span aria-hidden="true">▾</span>
          </button>
          {pages.map(([href, label]) => (
            <Link key={href} href={href} aria-current={current(href)}>
              {label}
            </Link>
          ))}
        </nav>
        <AnimatePresence>
          {open === 'products' && (
            <motion.div
              key="products"
              id="products-menu"
              className="mega"
              {...menu}
              transition={{ duration: 0.18 }}
            >
              {products.map((product) => (
                <Link key={product.key} href={`/products/${product.key}`}>
                  <span className="mark-s">
                    <Icon name={product.icon} />
                  </span>
                  <span>
                    <b>{product.name}</b>
                    {product.line}
                  </span>
                </Link>
              ))}
            </motion.div>
          )}
          {open === 'phone' && (
            <motion.div key="phone" id="phone-menu" className="phone-menu" {...menu}>
              <Link href="/">Home</Link>
              {products.map((product) => (
                <Link key={product.key} href={`/products/${product.key}`}>
                  {product.name}
                </Link>
              ))}
              {pages.map(([href, label]) => (
                <Link key={href} href={href}>
                  {label}
                </Link>
              ))}
              <a href={links.signIn}>Sign in</a>
            </motion.div>
          )}
        </AnimatePresence>
        <div className="nav-end">
          <a className="btn btn-dark signin" href={links.signIn}>
            Sign in
          </a>
          <a className="btn btn-gold" href={links.signUp}>
            Start free <Arrow />
          </a>
          <button
            type="button"
            className="btn btn-dark menu-toggle"
            aria-expanded={open === 'phone'}
            aria-controls="phone-menu"
            onClick={() => toggle('phone')}
          >
            Menu
          </button>
        </div>
      </div>
    </header>
  );
}
