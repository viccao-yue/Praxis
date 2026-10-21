import * as React from 'react';
import {
  PRAXIS_SIDEBAR_LOCKUP_HEIGHT,
  PRAXIS_SIDEBAR_LOCKUP_MASK_DATA_URL,
  PRAXIS_SIDEBAR_LOCKUP_WIDTH,
} from '../assets/praxis-sidebar-lockup.js';

export type SidebarBrandLockupProps = {
  /** Official square edge hint; expanded row keeps height and expands width. */
  readonly size?: number;
};

/**
 * Sidebar brand mark: full Praxis lockup (icon + PRAXIS + 开物).
 * Collapsed rail clips to the capsule via ShellAppearance.
 */
export function SidebarBrandLockup({ size = 24 }: SidebarBrandLockupProps) {
  const reactId = React.useId().replace(/:/g, '');
  const maskId = `praxis-sidebar-lockup-${reactId}`;
  const height = size;
  const width = Math.round((height * PRAXIS_SIDEBAR_LOCKUP_WIDTH) / PRAXIS_SIDEBAR_LOCKUP_HEIGHT);
  return (
    <svg
      data-praxis-sidebar-lockup=""
      data-testid="workdsh-brand"
      width={width}
      height={height}
      viewBox={`0 0 ${PRAXIS_SIDEBAR_LOCKUP_WIDTH} ${PRAXIS_SIDEBAR_LOCKUP_HEIGHT}`}
      role="img"
      aria-label="开物Praxis"
      focusable={false}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={PRAXIS_SIDEBAR_LOCKUP_WIDTH}
          height={PRAXIS_SIDEBAR_LOCKUP_HEIGHT}
        >
          <image
            href={PRAXIS_SIDEBAR_LOCKUP_MASK_DATA_URL}
            width={PRAXIS_SIDEBAR_LOCKUP_WIDTH}
            height={PRAXIS_SIDEBAR_LOCKUP_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
          />
        </mask>
      </defs>
      <rect
        width={PRAXIS_SIDEBAR_LOCKUP_WIDTH}
        height={PRAXIS_SIDEBAR_LOCKUP_HEIGHT}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
