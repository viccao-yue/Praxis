import * as React from 'react';
import { HeroBrandLockup } from './HeroBrandLockup.js';
import { SidebarBrandLockup } from './SidebarBrandLockup.js';

/** Expanded name is folded into the sidebar lockup; keep seat occupied but empty. */
export function BrandName() {
  return null;
}

export function BrandMark(props: { size?: number }) {
  return <SidebarBrandLockup size={props.size ?? 24} />;
}

/** Empty-session hero: replaces the official fish + headline chrome visually. */
export function HeroBrandMark(props: { size?: number; className?: string }) {
  return <HeroBrandLockup size={props.size ?? 44} className={props.className} />;
}

export function DiagnosticsMark() {
  return <span aria-hidden>P</span>;
}
