import * as React from 'react';

// Single stroke set: 24×24, 1.7px, round caps/joins. Nav semantics stay fixed;
// geometry is refreshed so entries read clearer at 20px without changing meaning.
const paths = {
  panel: 'M5 4h14a2 2 0 012 2v12a2 2 0 01-2 2H5a2 2 0 01-2-2V6a2 2 0 012-2zM9 4v16',
  search: 'M16.5 16.5L21 21M18 10.5a7.5 7.5 0 11-15 0 7.5 7.5 0 0115 0',
  plus: 'M12 5v14M5 12h14',
  chevron: 'M7 10l5 5 5-5',
  back: 'M15 19l-7-7 7-7',
  task: 'M21 11.5a8.5 8.5 0 01-8.5 8.5H5l-3 2v-9.5A8.5 8.5 0 0110.5 4H13M8 10h8M8 14h5',
  assistant: 'M12 2v2M8.5 5h7A3.5 3.5 0 0119 8.5v8A3.5 3.5 0 0115.5 20h-7A3.5 3.5 0 015 16.5v-8A3.5 3.5 0 018.5 5zM9 10.5h.01M15 10.5h.01M9.5 15.5c1.2 1 3.8 1 5 0',
  // 协同空间：协作节点（上一下二）
  project: 'M12 4.5a2.75 2.75 0 110 5.5 2.75 2.75 0 010-5.5zM5.25 15.25a2.75 2.75 0 110 5.5 2.75 2.75 0 010-5.5zM18.75 15.25a2.75 2.75 0 110 5.5 2.75 2.75 0 010-5.5zM12 10v3.25M8.4 15.7l2.2-2M15.6 15.7l-2.2-2',
  // 数字员工：人物侧影
  experts: 'M20 21v-2.2A3.8 3.8 0 0016.2 15H7.8A3.8 3.8 0 004 18.8V21M12 11.5a4 4 0 100-8 4 4 0 000 8',
  // 技能：能力星芒（仍表示可调用能力，不是代码括号装饰）
  skills: 'M12 2.5l1.55 5.7L19.5 9.5l-5.2 1.7L12 17l-2.3-5.8L4.5 9.5l5.95-1.3L12 2.5zM19.2 15.2l.85 2.55 2.55.85-2.55.85-.85 2.55-.85-2.55-2.55-.85 2.55-.85.85-2.55z',
  // 连接器：链接环
  connectors: 'M10 13.5a4.5 4.5 0 006.6.55l2.4-2.4a4.5 4.5 0 00-6.36-6.36l-1.4 1.4M14 10.5a4.5 4.5 0 00-6.6-.55l-2.4 2.4a4.5 4.5 0 006.36 6.36l1.4-1.4',
  // 资料库：展开书本
  library: 'M4 4.5h5.5A3.5 3.5 0 0113 8v12.5a2.5 2.5 0 00-2.5-2.5H4V4.5zM20 4.5h-5.5A3.5 3.5 0 0011 8v12.5a2.5 2.5 0 012.5-2.5H20V4.5z',
  automation: 'M12 7.5v5l3.5 2M5.2 4.2L3 6.5M18.8 4.2L21 6.5M5.2 19.8L3 17.5M18.8 19.8L21 17.5M21 12a9 9 0 11-18 0 9 9 0 0118 0',
  apps: 'M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h6v6h-6z',
  more: 'M4 4h6v6H4zM14 3v8M10 7h8M7 14.5l3.5 6.5H3.5zM20 18a3.5 3.5 0 11-7 0 3.5 3.5 0 017 0',
  settings: 'M12.3 2.5h-.6l-1 2.1-2.3.7-1.9-1.4-.5.5 1.4 1.9-.7 2.3-2.1 1v.6l2.1 1 .7 2.3-1.4 1.9.5.5 1.9-1.4 2.3.7 1 2.1h.6l1-2.1 2.3-.7 1.9 1.4.5-.5-1.4-1.9.7-2.3 2.1-1v-.6l-2.1-1-.7-2.3 1.4-1.9-.5-.5-1.9 1.4-2.3-.7-1-2.1zM15.2 12a3.2 3.2 0 11-6.4 0 3.2 3.2 0 016.4 0',
  folder: 'M3 7V5.5A1.5 1.5 0 014.5 4H9l2 2.5h8.5A1.5 1.5 0 0121 8v10.5a1.5 1.5 0 01-1.5 1.5h-15A1.5 1.5 0 013 18.5V7z',
  close: 'M6 6l12 12M18 6L6 18',
  // 最近：时钟
  recent: 'M12 21a9 9 0 100-18 9 9 0 000 18zM12 7v5.2l3.6 2.1',
  // 本地产物：交付物纸箱
  outputs: 'M21 8.25l-9-4.75-9 4.75v7.5l9 4.75 9-4.75v-7.5zM3 8.25l9 4.75 9-4.75M12 13v7.5M7.5 10.6l9 4.75',
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
