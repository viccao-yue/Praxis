import * as React from 'react';

/** Presentation-only adapter for the pinned Harness layout. Never changes hit areas. */
export function ShellAppearance() {
  return <style>{`
    [class$="_sidebarCol"] { border-right-color: transparent; }
    [data-platform="darwin"] [class$="_centerCol"] { border-left-color: transparent; }
    [data-side="sidebar"]:hover { background: color-mix(in srgb, var(--dsw-alias-label-primary) 5%, transparent); }
    [data-side="sidebar"][data-dragging] { background: color-mix(in srgb, var(--dsw-alias-label-primary) 9%, transparent); }
    /* Slot wrappers nest the mark; hide residual EmptyHero headline + preview badge. */
    [class*="_headline"]:has([data-praxis-hero-lockup]) > [class*="_titleGroup"] { display: none !important; }
    [data-praxis-hero-lockup] { animation: none !important; transform: translateY(-20px) !important; }
    /* Sidebar lockup already includes wordmark; drop duplicate name and clip rail to capsule. */
    [class*="_brandIdentity"]:has([data-praxis-sidebar-lockup]) [class*="_brandName"] { display: none !important; }
    [class*="_brandIdentity"]:has([data-praxis-sidebar-lockup]) { gap: 0 !important; }
    [class*="_railMark"] [data-praxis-sidebar-lockup] {
      width: 24px !important;
      overflow: hidden;
    }
  `}</style>;
}
