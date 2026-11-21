import type { SVGProps } from 'react';

// Icons the shared kit lacks, drawn in the same style as src/core/components/Icons.tsx.
type P = SVGProps<SVGSVGElement>;
const base = (props: P) => ({ className: `ico ${props.className ?? ''}`.trim(), viewBox: '0 0 24 24', 'aria-hidden': true as const, focusable: false, ...props });

/** Contractor badge: an ID card on a lanyard. */
export const IcoBadge = (p: P) => (<svg {...base(p)}><rect x="5" y="6" width="14" height="15" rx="2" /><path d="M9 3h6v3H9z" /><circle cx="12" cy="12" r="2.2" /><path d="M8.5 18a3.5 3.5 0 0 1 7 0" /></svg>);
