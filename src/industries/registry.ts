// Every industry demo is registered here. To add one, see docs/REUSE_GUIDE.md.
import type { IndustryConfig } from '../core/types';
import optometry from './optometry';
import medical from './medical';
import automotive from './automotive';
import mining from './mining';
import legal from './legal';

export const INDUSTRIES: IndustryConfig[] = [optometry, medical, automotive, mining, legal];

export function getIndustry(id: string | undefined): IndustryConfig | undefined {
  return INDUSTRIES.find((c) => c.id === id);
}
