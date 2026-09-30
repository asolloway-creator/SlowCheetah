import type { ReactNode } from 'react';
import Link from 'next/link';

/** A plain reading page: title, standfirst, sections, and when it last changed. */
export function Doc({ title, lede, updated, children }: { title: string; lede: ReactNode; updated: string; children: ReactNode }) {
  return (
    <article className="doc">
      <h1 className="page-title">{title}</h1>
      <p className="doc-lede">{lede}</p>
      {children}
      <p className="doc-updated">
        Last updated {updated}. Questions: <a href="mailto:asolloway@gmail.com?subject=IOI%3A%20privacy">asolloway@gmail.com</a>
      </p>
      <nav className="doc-nav" aria-label="Related pages">
        <Link href="/plans-and-privacy">How IOI uses plans</Link>
        <Link href="/privacy">Privacy</Link>
        <Link href="/terms">Terms</Link>
      </nav>
    </article>
  );
}

export function DocSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="doc-section">
      <h2 className="section-h">{title}</h2>
      {children}
    </section>
  );
}
