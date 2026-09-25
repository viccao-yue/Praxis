import * as React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client';
import type {} from '@deepseek-ai/dsh-client-ui-settings/client';
import type {} from '@deepseek-ai/dsh-client-ui-slots';
import { visionSettingsCss } from './styles.js';

export const name = 'workdsh-vision-client';
export const inject = ['slots'];

type VisionModel = { id: string; provider: string; image?: boolean; native?: boolean };
type VisionState = {
  version?: string;
  provider?: string;
  defaultModel?: string;
  configuredRoute?: { provider: string; model: string } | null;
  models?: VisionModel[];
  nativeVisionModels?: string[];
  enabled?: boolean;
  error?: string;
};

const STORAGE_KEY = 'workdsh-vision.route';
const ROUTE_SEP = '\u0000';

async function fetchState(): Promise<VisionState> {
  const response = await fetch('/vision/api/state', { cache: 'no-store' });
  let body: VisionState | null = null;
  try { body = await response.json() as VisionState; } catch { body = null; }
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`);
  }
  return body ?? {};
}

async function postModel(args: { model: string | null; provider?: string }): Promise<VisionState> {
  const response = await fetch('/vision/api/model', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(args),
    cache: 'no-store',
  });
  let body: VisionState | null = null;
  try { body = await response.json() as VisionState; } catch { body = null; }
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`);
  }
  return body ?? {};
}

async function postEnabled(enabled: boolean): Promise<boolean> {
  const response = await fetch('/vision/api/enabled', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ enabled }),
    cache: 'no-store',
  });
  let body: { enabled?: boolean; error?: string } | null = null;
  try { body = await response.json() as { enabled?: boolean; error?: string }; } catch { body = null; }
  if (!response.ok) {
    throw new Error(typeof body?.error === 'string' ? body.error : `HTTP ${response.status}`);
  }
  return body?.enabled === true;
}

function VisionSettingsPanel() {
  const [state, setState] = React.useState<VisionState>();
  const [selected, setSelected] = React.useState('');
  const [enabled, setEnabled] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [toggling, setToggling] = React.useState(false);
  const [saved, setSaved] = React.useState(false);
  const [error, setError] = React.useState('');
  const [loading, setLoading] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    void fetchState()
      .then((next) => {
        if (cancelled) return;
        setState(next);
        setEnabled(next.enabled !== false);
        const stored = localStorage.getItem(STORAGE_KEY);
        if (next.configuredRoute) {
          setSelected(`${next.configuredRoute.provider}${ROUTE_SEP}${next.configuredRoute.model}`);
        } else if (stored) {
          setSelected(stored);
        } else {
          setSelected('');
        }
        setError('');
      })
      .catch((cause) => {
        if (cancelled) return;
        setError(cause instanceof Error ? cause.message : String(cause));
        setState(undefined);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  const toggleEnabled = async (next: boolean) => {
    setToggling(true);
    setError('');
    try {
      const savedEnabled = await postEnabled(next);
      setEnabled(savedEnabled);
      setState((current) => current ? { ...current, enabled: savedEnabled } : current);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setToggling(false);
    }
  };

  const save = async () => {
    setSaving(true);
    setSaved(false);
    setError('');
    try {
      let next: VisionState;
      if (!selected) {
        next = await postModel({ model: null });
        localStorage.removeItem(STORAGE_KEY);
      } else {
        const [provider, model] = selected.split(ROUTE_SEP);
        next = await postModel({ model, provider });
        localStorage.setItem(STORAGE_KEY, selected);
      }
      setState(next);
      if (typeof next.enabled === 'boolean') setEnabled(next.enabled);
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setSaving(false);
    }
  };

  const visionModels = (state?.models ?? []).filter((row) => row.image);
  const current = state?.configuredRoute
    ? `${state.configuredRoute.provider}/${state.configuredRoute.model}`
    : `自动选择${state?.defaultModel ? `（${state.defaultModel}）` : ''}`;

  return (
    <div className="wd-vision-card">
      <style>{visionSettingsCss}</style>
      <div className="wd-vision-head">
        <span className={`wd-vision-badge ${enabled ? '' : 'off'}`}>
          {enabled ? '● 运行中' : '● 已关闭'}
        </span>
        {state?.version && <span className="wd-vision-muted">引擎 v{state.version}</span>}
      </div>
      <p className="wd-vision-lead">
        纯文本主模型粘贴图片时，由下方视觉模型转写成文字后再交给主模型。
      </p>
      <label className="wd-vision-switch">
        <input
          type="checkbox"
          role="switch"
          checked={enabled}
          disabled={toggling || loading}
          onChange={(event) => void toggleEnabled(event.currentTarget.checked)}
        />
        <span>启用视觉增强</span>
      </label>
      {loading && <p className="wd-vision-muted">加载中…</p>}
      {error && <p className="wd-vision-error" role="alert">{error}</p>}
      {!loading && state && (
        <>
          <label className="wd-vision-field">
            <span>默认视觉模型</span>
            <select value={selected} disabled={saving || !enabled} onChange={(event) => { setSelected(event.target.value); setSaved(false); }}>
              <option value="">自动选择（推荐）</option>
              {visionModels.map((row) => (
                <option key={`${row.provider}/${row.id}`} value={`${row.provider}${ROUTE_SEP}${row.id}`}>
                  {row.id} · {row.provider}{row.native ? ' · 原生视觉' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="wd-vision-actions">
            <button type="button" className="wd-vision-save" disabled={saving || !enabled} onClick={() => void save()}>
              {saving ? '保存中…' : '保存'}
            </button>
            {saved && <span className="wd-vision-ok">已保存，立即生效</span>}
          </div>
          <div className="wd-vision-hint">
            <div>当前：{current} · 路由：{state.provider || '—'}</div>
            <div>原生视觉模型（直接看图、不转写）：{(state.nativeVisionModels ?? []).join('、') || '—'}</div>
            <div>若粘贴图片仍被拒绝，请在模型设置中为所用纯文本模型声明图片输入能力（input / inputModalities）。</div>
          </div>
        </>
      )}
    </div>
  );
}

export function apply(ctx: Context): void {
  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'workdsh-vision',
    order: 26,
    label: '视觉增强',
  }, VisionSettingsPanel));
}
