import { Button, Input } from 'workdsh-ui';
import * as React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
// The `main` slot PropsRuntime is augmented by the official layout client module;
// without this side-effect type import the slot name resolves to `never`.
import type {} from '@deepseek-ai/dsh-client-ui-layout/client';
import type { InjectFace, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots';
import { Icon, Modal, type IconName } from 'workdsh-ui';
import type { ExpertAvailability, ExpertSummary } from '../shared.js';
import type { ExpertManagementClient } from './management.js';
import { ExpertDetailModal } from './ExpertDetailModal.js';
import { expertDraftId } from '../domain/navigation.js';
import { ExpertDraftEditor } from './ExpertDraftEditor.js';
import { ImportExpertModal } from './ImportExportModals.js';
import { expertsCss } from './styles.js';

type ExpertsPanelInjected = {
  toggleNavigation: () => void;
  management: ExpertManagementClient;
  /** Summon a published expert into a fresh bound native Session; never auto-sends. */
  summon: (expertId: string, revisionId: string | undefined, draftText: string | undefined) => Promise<void>;
  /** Open a new native task seeded with the `/workdsh-expert-manager` guide draft. */
  createExpertTask: (kind?: 'agent' | 'team') => Promise<void>;
  editExpertTask: (expertId: string) => Promise<void>;
};
export type ExpertsPanelProps = PropsRuntime<'main'> & InjectFace<ExpertsPanelInjected>;

type View = 'center' | 'mine';
type OriginFilter = 'all' | 'default' | 'personal';
type StateFilter = 'all' | 'draft' | 'published' | 'disabled' | 'archived';
type Notice = { kind: 'info' | 'warn' | 'error'; text: string };

function messageOf(cause: unknown): string { return cause instanceof Error ? cause.message : '数字员工操作失败，请重试。'; }
function codeOf(cause: unknown): string { const code = (cause as unknown as { code?: unknown })?.code; return typeof code === 'string' ? code : ''; }
function icon(name: string) { return <Icon name={name as IconName} />; }

const ORIGIN_LABEL: Record<string, string> = { default: '默认模板', personal: '我的数字员工', organization: '组织' };
const AVAILABILITY_LABEL: Record<ExpertAvailability, string> = { enabled: '已启用', disabled: '已停用', archived: '已归档' };
const READINESS: Record<string, { label: string; cls: string }> = {
  ready: { label: '可用', cls: 'ready' },
  'missing-dependency': { label: '依赖缺失', cls: 'bad' },
  'unsupported-capability': { label: '能力未满足', cls: 'warn' },
  broken: { label: 'preset 异常', cls: 'bad' },
  unknown: { label: '未发布', cls: '' },
};

function Avatar({ summary }: { summary: ExpertSummary }) {
  const hasImage = summary.avatarRef?.startsWith('data:image/') || summary.avatarRef?.startsWith('http://') || summary.avatarRef?.startsWith('https://');
  return <span className="avatar" aria-hidden>
    {hasImage && summary.avatarRef
      ? <img src={summary.avatarRef} alt="" />
      : <span className="avatar-placeholder">{summary.name.trim().charAt(0) || '专'}</span>}
  </span>;
}

function cardSubtitle(summary: ExpertSummary, mine: boolean, state: string): string {
  const base = summary.profession?.trim()
    || (summary.expertType === 'team' ? '数字员工团' : '数字员工');
  return mine ? `${base} · ${state}` : base;
}

/** This release ships single digital employees only; team UI stays hidden (Host/API retained). */
const TEAMS_UI_ENABLED = false;

export function ExpertsPanel({ toggleNavigation, management, summon, createExpertTask, editExpertTask }: ExpertsPanelProps) {
  const [view, setView] = useState<View>(() => expertDraftId(window.location.search) || new URLSearchParams(window.location.search).get('expert-library') === 'mine' ? 'mine' : 'center');
  const [kind, setKind] = useState<'agent' | 'team'>(() => TEAMS_UI_ENABLED && new URLSearchParams(window.location.search).get('expert-kind') === 'team' ? 'team' : 'agent');
  const [typeCounts, setTypeCounts] = useState({ agent: 0, team: 0 });
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [originFilter, setOriginFilter] = useState<OriginFilter>('all');
  const [stateFilter, setStateFilter] = useState<StateFilter>('all');
  const [items, setItems] = useState<readonly ExpertSummary[]>([]);
  const [total, setTotal] = useState(0);
  const [nextCursor, setNextCursor] = useState<string | undefined>();
  const [busy, setBusy] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState<Notice | undefined>();
  const [mineCount, setMineCount] = useState(0);
  const [detailId, setDetailId] = useState<string>();
  const [editorId, setEditorId] = useState<string | undefined>(() => expertDraftId(window.location.search));
  const [importOpen, setImportOpen] = useState(false);
  const [actionMenu, setActionMenu] = useState<string>();
  const [acting, setActing] = useState(false);
  const search = useRef<HTMLInputElement>(null);
  const loadSequence = useRef(0);
  const effectiveKind = TEAMS_UI_ENABLED ? kind : 'agent';
  const kindLabel = effectiveKind === 'team' ? '数字员工团' : '数字员工';

  useEffect(() => {
    if (!TEAMS_UI_ENABLED && kind !== 'agent') setKind('agent');
  }, [kind]);

  useEffect(() => {
    const url = new URL(window.location.href);
    if (view === 'mine') { url.searchParams.set('expert-library', 'mine'); url.searchParams.set('expert-kind', effectiveKind); }
    else { url.searchParams.delete('expert-library'); url.searchParams.set('expert-kind', effectiveKind); }
    window.history.replaceState(window.history.state, '', url);
  }, [view, effectiveKind]);

  useEffect(() => { const timer = window.setTimeout(() => setDebounced(query.trim()), 300); return () => window.clearTimeout(timer); }, [query]);

  const buildQuery = useCallback(() => {
    const search_ = debounced || undefined;
    if (view === 'center') {
      // Do not hard-filter to enabled: a mistaken disable of a built-in default must remain
      // findable here (mine view only lists personal). Enabled rows still sort first via Host.
      return { expertType: effectiveKind, ...(search_ ? { search: search_ } : {}), ...(originFilter === 'all' ? {} : { origin: originFilter as 'default' | 'personal' }), limit: 100 };
    }
    const availability = stateFilter === 'disabled' || stateFilter === 'archived' || stateFilter === 'published'
      ? (stateFilter === 'published' ? 'enabled' : stateFilter) as ExpertAvailability : undefined;
    return { expertType: effectiveKind, ...(search_ ? { search: search_ } : {}), origin: 'personal' as const, ...(availability ? { availability } : {}), limit: 100 };
  }, [view, effectiveKind, debounced, originFilter, stateFilter]);

  const load = useCallback(async (cursor?: string) => {
    const sequence = ++loadSequence.current;
    const appending = cursor !== undefined;
    if (appending) setLoadingMore(true); else { setBusy(true); setNotice(undefined); }
    setError('');
    try {
      const base = buildQuery();
      const result = await management.list(cursor ? { ...base, cursor } : base);
      if (sequence !== loadSequence.current) return;
      setItems(prev => (appending ? [...prev, ...result.items] : result.items));
      setTotal(result.total);
      setNextCursor(result.nextCursor);
    } catch (cause) {
      if (sequence !== loadSequence.current) return;
      if (codeOf(cause) === 'experts/cursor-stale') {
        setNotice({ kind: 'warn', text: '目录已变化，分页游标失效，已为你重新加载第一页。' });
        setItems([]); setNextCursor(undefined);
        try { const fresh = await management.list(buildQuery()); setItems(fresh.items); setTotal(fresh.total); setNextCursor(fresh.nextCursor); } catch { /* surfaced below */ }
      } else setError(messageOf(cause));
    } finally { if (sequence === loadSequence.current) { setBusy(false); setLoadingMore(false); } }
  }, [buildQuery, management]);

  const loadMineCount = useCallback(async () => {
    try {
      const agent = await management.list({ origin: 'personal', expertType: 'agent', limit: 1 });
      if (TEAMS_UI_ENABLED) {
        const team = await management.list({ origin: 'personal', expertType: 'team', limit: 1 });
        setTypeCounts({ agent: agent.total, team: team.total });
        setMineCount(agent.total + team.total);
      } else {
        setTypeCounts({ agent: agent.total, team: 0 });
        setMineCount(agent.total);
      }
    } catch { /* non-fatal badge */ }
  }, [management]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadMineCount(); }, [loadMineCount, items]);
  useEffect(() => {
    const revalidate = () => { if (document.visibilityState === 'visible') { void load(); void loadMineCount(); } };
    window.addEventListener('focus', revalidate); document.addEventListener('visibilitychange', revalidate);
    return () => { window.removeEventListener('focus', revalidate); document.removeEventListener('visibilitychange', revalidate); };
  }, [load, loadMineCount]);
  useEffect(() => {
    if (!actionMenu) return;
    const outside = (event: PointerEvent) => { if (!(event.target instanceof Element) || !event.target.closest('.card-actions')) setActionMenu(undefined); };
    document.addEventListener('pointerdown', outside); return () => document.removeEventListener('pointerdown', outside);
  }, [actionMenu]);

  const visible = useMemo(() => {
    if (view === 'center') return items.filter(item => item.publishedRevisionRef !== undefined);
    if (stateFilter === 'draft') return items.filter(item => item.publishedRevisionRef === undefined);
    if (stateFilter === 'published') return items.filter(item => item.publishedRevisionRef !== undefined);
    return items;
  }, [items, view, stateFilter]);

  const refresh = useCallback(() => { void load(); void loadMineCount(); }, [load, loadMineCount]);
  const closeEditor = () => {
    setEditorId(undefined);
    const url = new URL(window.location.href);
    url.searchParams.delete('expert-draft');
    window.history.replaceState(window.history.state, '', url);
  };

  const runSummon = async (expertId: string, revisionId: string | undefined, draftText: string | undefined) => {
    setActing(true); setError('');
    try { await summon(expertId, revisionId, draftText); setDetailId(undefined); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setActing(false); }
  };
  const createExpert = async (type: 'agent' | 'team' = effectiveKind) => {
    if (!TEAMS_UI_ENABLED && type === 'team') return;
    setActing(true); setError('');
    try { await createExpertTask(type); } catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
  };
  const setPreference = async (summary: ExpertSummary, pinned: boolean) => {
    setActionMenu(undefined);
    try { await management.setPreference(summary.id, pinned); refresh(); } catch (cause) { setError(messageOf(cause)); }
  };
  const copyToMine = async (summary: ExpertSummary) => {
    setActionMenu(undefined); setActing(true); setError('');
    try {
      const draft = await management.copy(summary.id, summary.publishedRevisionRef?.revisionId, management.newOperationId('copy'));
      refresh(); setEditorId(draft.expertId);
    } catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
  };
  const setAvailability = async (summary: ExpertSummary, availability: ExpertAvailability) => {
    setActionMenu(undefined); setActing(true); setError('');
    try { await management.setAvailability(summary.id, availability, management.newOperationId('availability')); refresh(); if (detailId === summary.id) setDetailId(undefined); }
    catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
  };
  const deleteArchived = async (summary: ExpertSummary) => {
    if (summary.availability !== 'archived' || summary.origin === 'default') return;
    const confirmed = window.confirm(`确认永久删除「${summary.name}」？删除后无法从目录恢复，Agent 预设中的对应条目也会移除；历史任务引用仍保留。`);
    if (!confirmed) { setActionMenu(undefined); return; }
    setActionMenu(undefined); setActing(true); setError('');
    try {
      await management.deleteArchived(summary.id, management.newOperationId('delete'));
      if (detailId === summary.id) setDetailId(undefined);
      if (editorId === summary.id) setEditorId(undefined);
      setNotice({ kind: 'info', text: `已删除「${summary.name}」。` });
      refresh();
    } catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
  };
  const exportExpert = async (summary: ExpertSummary) => {
    setActionMenu(undefined); setActing(true); setError('');
    try { const result = await management.downloadExport(summary.id, summary.publishedRevisionRef?.revisionId); setNotice({ kind: 'info', text: `已导出「${result.fileName}」（${result.bytes} 字节，摘要 ${result.digest.slice(0, 12)}…）。` }); }
    catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
  };

  const isDraft = (summary: ExpertSummary) => summary.publishedRevisionRef === undefined;
  const stateLabel = (summary: ExpertSummary) => isDraft(summary) ? '草稿' : AVAILABILITY_LABEL[summary.availability];

  const editInConversation = async (id: string) => {
    setActing(true); setActionMenu(undefined);
    try { await editExpertTask(id); setDetailId(undefined); }
    catch (cause) { setError(messageOf(cause)); }
    finally { setActing(false); }
  };

  return <section className="wd-experts" data-testid="workdsh-experts">
    <style>{expertsCss}</style>
    <header className="cap-header">
      <button className="nav-toggle" onClick={toggleNavigation} aria-label="切换导航">导航</button>
      <h1 className="cap-title">{icon('experts')}数字员工</h1>
      <Input ref={search} className="search" aria-label="搜索数字员工" placeholder={view === 'mine' ? `搜索我创建的${kindLabel}` : `搜索${kindLabel}`} value={query}
        onChange={event => setQuery(event.currentTarget.value)} />
      <Button className={`mine-toggle ${view === 'mine' ? 'active' : ''}`} aria-pressed={view === 'mine'}
        onClick={() => { setView('mine'); setQuery(''); }}>我的数字员工 {mineCount}</Button>
      {TEAMS_UI_ENABLED
        ? <details className="create-menu"><summary className="create-expert">＋ 制作数字员工</summary><div role="menu">
          <button role="menuitem" disabled={acting} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void createExpert('agent'); }}>创建数字员工</button>
          <button role="menuitem" disabled={acting} onClick={event => { event.currentTarget.closest('details')?.removeAttribute('open'); void createExpert('team'); }}>创建数字员工团</button>
        </div></details>
        : <Button variant="primary" className="create-expert" disabled={acting} onClick={() => void createExpert('agent')}>＋ 制作数字员工</Button>}
    </header>

    {view === 'mine' && <Button variant="ghost" size="sm" className="back-center" onClick={() => { setView('center'); setQuery(''); setStateFilter('all'); }}>‹ 全部数字员工</Button>}
    {TEAMS_UI_ENABLED && <div className="section-head">
      <nav className="work-types" aria-label={view === 'mine' ? '我的作品类型' : '数字员工中心类型'}>{([['agent', '数字员工'], ['team', '数字员工团']] as const).map(([type, label]) => <button key={type} className={kind === type ? 'active' : ''} aria-pressed={kind === type} onClick={() => { setKind(type); setQuery(''); }}>{label}{view === 'mine' && <span>{typeCounts[type]}</span>}</button>)}</nav>
      <div className="section-actions">
        <Button onClick={() => setImportOpen(true)}>导入</Button>
        <Button onClick={refresh} disabled={busy}>刷新</Button>
      </div>
    </div>}

    {view === 'center'
      ? <nav className="filter-tabs" aria-label="来源过滤">
        {([['all', '全部'], ['default', '默认'], ['personal', '我的']] as const).map(([key, label]) =>
          <Button key={key} className={originFilter === key ? 'active' : ''} aria-current={originFilter === key ? 'page' : undefined}
            onClick={() => setOriginFilter(key)}>{label}</Button>)}
      </nav>
      : <nav className="filter-tabs" aria-label="状态过滤">
        {([['all', '全部'], ['draft', '草稿'], ['published', '已发布'], ['disabled', '已停用'], ['archived', '已归档']] as const).map(([key, label]) =>
          <Button key={key} className={stateFilter === key ? 'active' : ''} aria-current={stateFilter === key ? 'page' : undefined}
            onClick={() => setStateFilter(key)}>{label}</Button>)}
      </nav>}

    {notice && <div className={`notice ${notice.kind}`} role="status"><div className="notice-body"><span>{notice.text}</span></div><Button onClick={() => setNotice(undefined)} aria-label="关闭提示">×</Button></div>}
    <div role="status" aria-live="polite" className={error ? 'error counts' : 'counts'}>
      {busy ? '正在读取数字员工目录…' : error || `目录共 ${total} 个${kindLabel} · 当前显示 ${visible.length} 个${debounced ? `（搜索“${debounced}”）` : ''}`}
    </div>

    {busy
      ? <div className="grid" aria-hidden>{Array.from({ length: 8 }, (_, index) => <div className="skeleton" key={index} />)}</div>
      : !error && !visible.length
        ? <div className="empty">
          <strong>{debounced ? `没有匹配的${kindLabel}` : view === 'mine' ? `还没有自己的${kindLabel}` : `暂无可用${kindLabel}`}</strong>
          <span className="muted">{debounced ? '保留搜索词，可清除后重试。' : view === 'mine' ? '从默认模板复制，或直接制作一个属于你的数字员工。' : '默认模板尚未就绪，请稍后重试或制作数字员工。'}</span>
          <div className="empty-actions">
            {debounced && <Button onClick={() => { setQuery(''); search.current?.focus(); }}>清除搜索</Button>}
            <Button variant="primary" className="create-expert" disabled={acting} onClick={() => void createExpert()}>创建{kindLabel}</Button>
            {view === 'mine' && <Button onClick={() => setView('center')}>浏览数字员工中心</Button>}
          </div>
        </div>
        : <div className="grid">{visible.map(summary => {
          const readiness = READINESS[summary.readiness] ?? READINESS.unknown;
          const draft = isDraft(summary);
          const usable = summary.canUse && !draft && summary.availability === 'enabled' && summary.readiness === 'ready';
          return <article className={`card ${draft ? 'draft' : ''} ${summary.availability !== 'enabled' ? 'unavailable' : ''} ${actionMenu === summary.id ? 'menu-open' : ''} ${summary.pinned ? 'pinned' : ''}`} key={summary.id}>
            <div className="card-top">
              <button className="card-open" aria-label={`查看数字员工 ${summary.name}`} onClick={() => setDetailId(summary.id)}>
                <Avatar summary={summary} />
                <span className="card-title">
                  <strong title={summary.name}>{summary.name}</strong>
                  <span className="card-meta" title={cardSubtitle(summary, view === 'mine', stateLabel(summary))}>
                    {cardSubtitle(summary, view === 'mine', stateLabel(summary))}
                  </span>
                </span>
              </button>
              <div className="card-actions">
                <Button variant="ghost" size="sm" className="more-button" aria-label={`管理数字员工 ${summary.name}`} aria-haspopup="menu" aria-expanded={actionMenu === summary.id}
                  onClick={() => setActionMenu(current => (current === summary.id ? undefined : summary.id))}>•••</Button>
                {actionMenu === summary.id && <div className="card-menu" role="menu">
                  {draft
                    ? <button role="menuitem" onClick={() => { void editInConversation(summary.id); }}>继续编辑</button>
                    : <button role="menuitem" disabled={!usable || acting} onClick={() => void runSummon(summary.id, summary.publishedRevisionRef?.revisionId, undefined)}>召唤数字员工</button>}
                  {summary.canEdit && !draft && <button role="menuitem" onClick={() => { void editInConversation(summary.id); }}>编辑</button>}
                  <button role="menuitem" disabled={acting} onClick={() => void copyToMine(summary)}>复制到我的数字员工</button>
                  <button role="menuitem" disabled={acting} onClick={() => void exportExpert(summary)}>导出</button>
                  <button role="menuitem" disabled={acting} onClick={() => void setPreference(summary, !summary.pinned)}>{summary.pinned ? '取消置顶' : '置顶'}</button>
                  {summary.canManage && summary.origin !== 'default' && !draft && summary.availability === 'enabled' && <button role="menuitem" disabled={acting} onClick={() => void setAvailability(summary, 'disabled')}>停用</button>}
                  {summary.canManage && (summary.availability === 'disabled' || summary.availability === 'archived') && <button role="menuitem" disabled={acting} onClick={() => void setAvailability(summary, 'enabled')}>启用</button>}
                  {summary.canManage && summary.origin !== 'default' && summary.availability !== 'archived' && <button className="danger" role="menuitem" disabled={acting} onClick={() => void setAvailability(summary, 'archived')}>归档</button>}
                  {summary.canManage && summary.origin !== 'default' && summary.availability === 'archived' && <button className="danger" role="menuitem" disabled={acting} onClick={() => void deleteArchived(summary)}>删除</button>}
                </div>}
              </div>
            </div>
            <button className="card-body" aria-label={`查看数字员工 ${summary.name}`} onClick={() => setDetailId(summary.id)}>
              <p className="desc">{summary.description || <span className="muted">（暂无简介）</span>}</p>
              <div className="domain-tags">
                {(summary.tags ?? []).slice(0, 3).map(tag => <span key={tag}>{tag}</span>)}
                {draft && <span className="status-tag">未发布</span>}
                {!draft && summary.availability !== 'enabled' && <span className="status-tag">{stateLabel(summary)}</span>}
                {!draft && (readiness.cls === 'bad' || readiness.cls === 'warn') && <span className={`status-tag ${readiness.cls}`}>{readiness.label}</span>}
              </div>
            </button>
          </article>;
        })}{view === 'mine' && <button className="card create-card" disabled={acting} onClick={() => void createExpert()}><span aria-hidden>＋</span>创建{kindLabel}</button>}</div>}

    {nextCursor && !busy && <div className="empty-actions" style={{ justifyContent: 'center', marginTop: 18 }}>
      <Button disabled={loadingMore} onClick={() => void load(nextCursor)}>{loadingMore ? '正在加载…' : '加载更多'}</Button>
    </div>}

    <Modal open={Boolean(detailId)} label={detailId ? '数字员工详情' : '数字员工详情'} className="expert-dialog" onClose={() => setDetailId(undefined)}>
      {detailId && <ExpertDetailModal expertId={detailId} management={management} acting={acting}
        onClose={() => setDetailId(undefined)}
        onSummon={(expertId, revisionId, draftText) => void runSummon(expertId, revisionId, draftText)}
        onEditTask={id => void editInConversation(id)}
        onEditDraft={id => { setDetailId(undefined); setEditorId(id); }}
        onCopy={async (expertId, revisionId) => {
          setActing(true);
          try { const draft = await management.copy(expertId, revisionId, management.newOperationId('copy')); setDetailId(undefined); refresh(); setEditorId(draft.expertId); }
          catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
        }}
        onAvailability={async (expertId, availability) => {
          setActing(true);
          try { await management.setAvailability(expertId, availability, management.newOperationId('availability')); setDetailId(undefined); refresh(); }
          catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
        }}
        onDelete={async (expertId, name) => {
          const confirmed = window.confirm(`确认永久删除「${name}」？删除后无法从目录恢复，Agent 预设中的对应条目也会移除；历史任务引用仍保留。`);
          if (!confirmed) return;
          setActing(true);
          try {
            await management.deleteArchived(expertId, management.newOperationId('delete'));
            setDetailId(undefined);
            if (editorId === expertId) setEditorId(undefined);
            setNotice({ kind: 'info', text: `已删除「${name}」。` });
            refresh();
          } catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
        }}
        onExport={async expertId => {
          setActing(true);
          try { const result = await management.downloadExport(expertId, undefined); setNotice({ kind: 'info', text: `已导出「${result.fileName}」。` }); }
          catch (cause) { setError(messageOf(cause)); } finally { setActing(false); }
        }}
        onChanged={refresh} />}
    </Modal>

    {editorId && <ExpertDraftEditor expertId={editorId} management={management}
      onClose={closeEditor}
      onSaved={refresh}
      onPublished={() => { closeEditor(); refresh(); }}
      onSummon={(id, revisionId, text) => { closeEditor(); void runSummon(id, revisionId, text); }} />}

    <Modal open={importOpen} label="导入数字员工" className="import-dialog" onClose={() => setImportOpen(false)}>
      {importOpen && <ImportExpertModal management={management} onClose={() => setImportOpen(false)}
        onImported={id => { setImportOpen(false); refresh(); setEditorId(id); }} />}
    </Modal>
  </section>;
}
