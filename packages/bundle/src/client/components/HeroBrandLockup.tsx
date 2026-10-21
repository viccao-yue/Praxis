import * as React from 'react';
import {
  PRAXIS_HERO_LOCKUP_HEIGHT,
  PRAXIS_HERO_LOCKUP_MASK_DATA_URL,
  PRAXIS_HERO_LOCKUP_WIDTH,
} from '../assets/praxis-hero-lockup.js';

export type HeroBrandLockupProps = {
  /** Official square edge hint; we keep height and expand width by aspect. */
  readonly size?: number;
  readonly className?: string;
};

/**
 * Blank-session hero mark: full Praxis lockup (icon + PRAXIS + 开物成务).
 * Painted with currentColor so Shell primary ink / theme stays consistent.
 */
export function HeroBrandLockup({ size = 44, className }: HeroBrandLockupProps) {
  const reactId = React.useId().replace(/:/g, '');
  const maskId = `praxis-hero-lockup-${reactId}`;
  const height = size;
  const width = Math.round((height * PRAXIS_HERO_LOCKUP_WIDTH) / PRAXIS_HERO_LOCKUP_HEIGHT);
  return (
    <svg
      data-praxis-hero-lockup=""
      className={className}
      width={width}
      height={height}
      viewBox={`0 0 ${PRAXIS_HERO_LOCKUP_WIDTH} ${PRAXIS_HERO_LOCKUP_HEIGHT}`}
      role="img"
      aria-label="开物Praxis"
      focusable={false}
      style={{ animation: 'none', transform: 'translateY(-20px)' }}
    >
      <defs>
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          x={0}
          y={0}
          width={PRAXIS_HERO_LOCKUP_WIDTH}
          height={PRAXIS_HERO_LOCKUP_HEIGHT}
        >
          <image
            href={PRAXIS_HERO_LOCKUP_MASK_DATA_URL}
            width={PRAXIS_HERO_LOCKUP_WIDTH}
            height={PRAXIS_HERO_LOCKUP_HEIGHT}
            preserveAspectRatio="xMidYMid meet"
          />
        </mask>
      </defs>
      <rect
        width={PRAXIS_HERO_LOCKUP_WIDTH}
        height={PRAXIS_HERO_LOCKUP_HEIGHT}
        fill="currentColor"
        mask={`url(#${maskId})`}
      />
    </svg>
  );
}
