import * as React from 'react';

const paths = {
  panel: 'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 4v16',
  search: 'M16 16l5 5M18 10a8 8 0 11-16 0 8 8 0 0116 0',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M7 10l5 5 5-5',
  back: 'M15 19l-7-7 7-7',
  task: 'M6 19l-3 2V9a9 9 0 119 9H6zM12 5v8M8 9h8',
  assistant: 'M9 3h6M12 1v2M7 6h10a3 3 0 013 3v9a3 3 0 01-3 3H7a3 3 0 01-3-3V9a3 3 0 013-3zM9 10h.01M15 10h.01M8 17a4 4 0 018 0',
  project: 'M12 4.5a2.75 2.75 0 110 5.5 2.75 2.75 0 010-5.5zM5.25 15.25a2.75 2.75 0 110 5.5 2.75 2.75 0 010-5.5zM18.75 15.25a2.75 2.75 0 110 5.5 2.75 2.75 0 010-5.5zM12 10v3.25M8.4 15.7l2.2-2M15.6 15.7l-2.2-2',
  experts: 'M20 21v-2.2A3.8 3.8 0 0016.2 15H7.8A3.8 3.8 0 004 18.8V21M12 11.5a4 4 0 100-8 4 4 0 000 8',
  skills: 'M12 2.5l1.55 5.7L19.5 9.5l-5.2 1.7L12 17l-2.3-5.8L4.5 9.5l5.95-1.3L12 2.5zM19.2 15.2l.85 2.55 2.55.85-2.55.85-.85 2.55-.85-2.55-2.55-.85 2.55-.85.85-2.55z',
  connectors: 'M10 13.5a4.5 4.5 0 006.6.55l2.4-2.4a4.5 4.5 0 00-6.36-6.36l-1.4 1.4M14 10.5a4.5 4.5 0 00-6.6-.55l-2.4 2.4a4.5 4.5 0 006.36 6.36l1.4-1.4',
  library: 'M4 4.5h5.5A3.5 3.5 0 0113 8v12.5a2.5 2.5 0 00-2.5-2.5H4V4.5zM20 4.5h-5.5A3.5 3.5 0 0011 8v12.5a2.5 2.5 0 012.5-2.5H20V4.5z',
  automation: 'M12 7.5v5l3.5 2M5.2 4.2L3 6.5M18.8 4.2L21 6.5M5.2 19.8L3 17.5M18.8 19.8L21 17.5M21 12a9 9 0 11-18 0 9 9 0 0118 0',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  plugin: 'M9 3v4M15 3v4M7 7h10v6a5 5 0 01-10 0V7zM12 18v3',
  workbench: 'M3.5 5.5h17v14h-17zM3.5 9.5h17M9.5 9.5v10',
  more: 'M3 3h6v6H3zM17 2v8M13 6h8M6 14l4 7H2zM21 18a4 4 0 11-8 0 4 4 0 018 0',
  settings: 'M9 3l1-2h4l1 2 3 2 2 0 2 4-1 2v3l1 2-2 4h-2l-3 2h-6l-3-2H4l-2-4 1-2v-3L2 9l2-4h2zM16 12a4 4 0 11-8 0 4 4 0 018 0',
  folder: 'M3 5h6l2 3h10v12H3z',
  close: 'M6 6l12 12M18 6L6 18',
} as const;

export type IconName = keyof typeof paths;

export type IconProps = {
  readonly name: IconName;
  readonly size?: number;
};

export function Icon({ name, size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden focusable={false}>
      <path d={paths[name]} />
    </svg>
  );
}
