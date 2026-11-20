declare module 'virtual:hub' {
  import type { ComponentType } from 'react';
  /** The owner homepage, or null in a single-industry client build. */
  const Hub: ComponentType | null;
  export default Hub;
}

declare module 'virtual:industries' {
  export const INDUSTRIES: unknown[];
  export const LOCKED_INDUSTRY: string | null;
}
