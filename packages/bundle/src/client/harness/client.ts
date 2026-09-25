import { PRAXIS_FAVICON_DATA_URL } from '../assets/praxis-favicon.js';
import { ShellAppearance } from '../components/ShellAppearance.js';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-api-remotes/client';
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-sidebar/client';
import * as workbench from 'workdsh-plugin-workbench';
import { BrandMark, BrandName, DiagnosticsMark, HeroBrandMark } from '../components/Brand.js';
import { DiagnosticsPanel, type Inventory } from '../components/DiagnosticsPanel.js';
import { NavigationLocation } from '../components/NavigationLocation.js';

export const name = 'workdsh-client';
export const inject = ['slots', 'layout', 'remote', 'remote.pluginInventory'];

const productViews: Readonly<Record<string, string>> = {
  experts: 'workdsh-experts', skills: 'workdsh-skills', assistant: 'workdsh-assistant', projects: 'workdsh-projects', 'project-detail': 'workdsh-project-detail',
  library: 'workdsh-library', automation: 'workdsh-automation', more: 'workdsh-more',
};

const PRODUCT_TITLE = '开物Praxis';
const OFFICIAL_PRODUCT_TITLE = 'DeepSeek Harness';

/**
 * The official layout owns `document.title` (`productTitle` is hardcoded) and
 * the static index owns the favicon. Rewrite the product name after each
 * official write, and swap the tab icon. Session titles stay: `任务 — 开物Praxis`.
 */
function installBrowserChrome(): () => void {
  const head = document.head;
  const previousTitle = document.title;
  const previousIcons = [...head.querySelectorAll('link[rel~="icon"]')].map(node => {
    const clone = node.cloneNode(true) as HTMLLinkElement;
    node.remove();
    return clone;
  });
  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = PRAXIS_FAVICON_DATA_URL;
  head.append(link);

  let writing = false;
  const rewriteTitle = () => {
    if (writing) return;
    const current = document.title;
    if (!current.includes(OFFICIAL_PRODUCT_TITLE)) return;
    writing = true;
    document.title = current.replaceAll(OFFICIAL_PRODUCT_TITLE, PRODUCT_TITLE);
    writing = false;
  };
  rewriteTitle();
  const titleNode = document.querySelector('title');
  const observer = new MutationObserver(rewriteTitle);
  if (titleNode) observer.observe(titleNode, { childList: true, characterData: true, subtree: true });

  return () => {
    observer.disconnect();
    link.remove();
    for (const node of previousIcons) head.append(node);
    document.title = previousTitle;
  };
}

export function apply(ctx: Context): void {
  ctx.effect(installBrowserChrome);
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({ name: 'shell.overlay', id: 'workdsh-shell-appearance' }, ShellAppearance));
  const diagnostics = new URL(window.location.href).searchParams.get('diagnostics') === '1';
  const viewToPanel = diagnostics ? { ...productViews, diagnostics: 'workdsh-probe' } : productViews;
  const panelToView = Object.fromEntries(Object.entries(viewToPanel).map(([view, panel]) => [panel, view]));
  const selectView = (view: string | null) => {
    const target = view === 'projects' && new URL(window.location.href).searchParams.has('project') ? 'project-detail' : view;
    const requested = target ? viewToPanel[target] : undefined;
    const selected = requested && ctx.slots.entriesOfSlot('main').some(entry => entry.options.key === requested)
      ? requested as Parameters<typeof ctx.layout.selectPanel>[0] : null;
    ctx.layout.selectPanel(selected);
    return selected;
  };

  // Appearance follows the official ThemeRuntime and the user's Settings and
  // system preference; the workbench must not pin a theme or veto theme/change.
  ctx.plugin(workbench);
  ctx.slots.inject('sidebar.brand.name', () => ctx.slots.register({ name: 'sidebar.brand.name', priority: -10 }, BrandName));
  ctx.slots.inject('sidebar.brand.mark', () => ctx.slots.register({ name: 'sidebar.brand.mark', priority: -10 }, BrandMark));
  // Official EmptyHero only exposes the mark seat; hide the residual headline/preview badge in ShellAppearance.
  ctx.slots.inject('conversation.hero.brand.mark', () => ctx.slots.register({ name: 'conversation.hero.brand.mark', priority: -10 }, HeroBrandMark));
  ctx.slots.inject('shell.overlay', () => ctx.slots.register({
    name: 'shell.overlay', id: 'workdsh-location', inject: () => ({ panelToView, selectView }),
  }, NavigationLocation));

  ctx.slots.inject('main', () => {
    const dispose = diagnostics ? ctx.slots.register({
      name: 'main', key: 'workdsh-probe', inject: () => ({
        inspect: async (): Promise<Inventory> => {
          const response = await ctx.remote.pluginInventory.list();
          if (!response.ok) throw new Error(response.error.code);
          return { total: response.value.entries.length, modules: response.value.entries
            .filter(row => row.moduleName.startsWith('workdsh-'))
            .map(row => ({ module: row.moduleName, phase: row.fiberPhase })) };
        },
        returnToConversation: () => ctx.layout.selectPanel(null),
      }),
    }, DiagnosticsPanel) : () => {};
    return dispose;
  });
  if (diagnostics) ctx.slots.inject('sidebar.panellist', () => ctx.slots.register({
    name: 'sidebar.panellist', id: 'workdsh-probe', label: '开物Praxis 接入验证', order: 90,
  }, DiagnosticsMark));
}
