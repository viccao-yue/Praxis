import * as React from 'react';
import type { Context } from '@deepseek-ai/cordis';
import type { ExpertManagementClient } from './management.js';
import { isNativePreset, nativePresetRows, preferredNativePresetId, requireNativePreset } from './preset-policy.js';

/**
 * A summoned expert is already bound for this blank session. Name it, and let the user clear
 * back to a native mode (prefer `standard`) before starting a normal conversation.
 */
function SummonedExpertSeat(props: any) {
  const state = props.useAgentPresetSeat((snapshot: any) => snapshot);
  const [clearing, setClearing] = React.useState(false);
  // A fresh slot callback must not turn a roster update into another roster request.
  const loadRef = React.useRef(props.load);
  loadRef.current = props.load;
  React.useEffect(() => { void loadRef.current(); }, [state.current]);
  const name = state.options.find((row: any) => row.id === state.current)?.name;
  const clear = async () => {
    const target = preferredNativePresetId(state.options);
    if (!target || clearing) return;
    setClearing(true);
    try { await props.select(target); }
    finally { setClearing(false); }
  };
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, font: 'inherit', color: 'inherit' }} title={name || '已召唤数字员工'}>
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true"><circle cx="12" cy="6" r="3"/><circle cx="5" cy="17" r="3"/><circle cx="19" cy="17" r="3"/><path d="M10 9 6.5 14M14 9l3.5 5M8 17h8"/></svg>
    <span style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name || '已召唤数字员工'}</span>
    <button type="button" disabled={clearing || !preferredNativePresetId(state.options)}
      aria-label={`取消选中${name || '数字员工'}，恢复正常模式`}
      title="取消选中，恢复正常模式"
      onClick={event => { event.preventDefault(); event.stopPropagation(); void clear(); }}
      style={{ display: 'inline-grid', placeItems: 'center', width: 20, height: 20, margin: 0, padding: 0, border: 0, borderRadius: 4, background: 'transparent', color: 'inherit', opacity: 0.7, cursor: clearing ? 'default' : 'pointer', font: 'inherit', lineHeight: 1 }}>
      ×
    </button>
  </span>;
}

/** Keep the native mount loader stable while always invoking the latest injected callback. */
function StableNativePresetSeat(props: any) {
  const { Native, ...seatProps } = props;
  const loadRef = React.useRef(props.load);
  loadRef.current = props.load;
  const load = React.useCallback(() => loadRef.current(), []);
  return <Native {...seatProps} load={load}/>;
}

/**
 * Native controllers stay owned by Harness; expert execution uses the binding-aware summon path.
 *
 * Only the new-session control is wrapped: `conversation.hero.agentPreset` is a single-seat
 * slot, so a later registration takes the seat over. `settings.section` is an additive list
 * slot (every registration is its own page with no replacement semantics), so wrapping it
 * only produced a duplicate "Agent 预设" page next to the Harness-owned one. The settings
 * page stays the Harness owner's; expert presets remain guarded by the Host-side preset
 * checks, not by a second client page.
 */
export function installExpertPresetMenu(ctx: Context, _management: ExpertManagementClient): void {
  const install = (key: string) => {
    let dispose: (() => void) | undefined;
    const ready = () => {
      if (dispose) return;
      const original = ctx.slots.entriesOfSlot(key as any).find((entry: any) => !!entry.inject);
      if (!original?.inject) return;
      const Native = original.component as React.ComponentType<any>;
      const projected = new WeakMap<object, any>();
      const project = (state: any) => {
        let value = projected.get(state);
        if (!value) {
          // Keep native modes only, and force showPicker so the hero chip is not
          // gated on roster timing / modeSelectionEnabled races after hard refresh.
          value = { ...state, options: nativePresetRows(state.options), showPicker: true };
          projected.set(state, value);
        }
        return value;
      };
      function PublicPresets(props: any) {
        const current = props.useAgentPresetSeat((state: any) => state.current);
        if (current && !isNativePreset(current)) return <SummonedExpertSeat {...props}/>;
        const useSeat = (selector: (state: any) => unknown) => props.useAgentPresetSeat((state: any) => selector(project(state)));
        // Official AgentPresetSeat returns null unless:
        //   useShowPresetPicker (wired to developerTools) && state.showPicker && mainView retain && ready.
        // Hard refresh often blanks the chip: developerTools starts false, and blank-session
        // mainView retain can lag behind the workspace picker. Product keeps the mode chip
        // next to the workspace control whenever the hero is up.
        const useShowPresetPicker = (selector: (value: boolean) => unknown) =>
          props.useAgentPresetSeat((_state: any) => selector(true));
        const useSessionRetainInfo = (selector: (info: any) => unknown) =>
          props.useSessionRetainInfo((info: any) => selector({
            ...(info ?? {}),
            retainedBy: { ...(info?.retainedBy ?? {}), mainView: Math.max(1, Number(info?.retainedBy?.mainView ?? 0)) },
          }));
        const select = async (id: string) => { requireNativePreset(id); return props.select(id); };
        // Expert presets must never become the profile-wide default for blank/new sessions.
        const makeDefault = props.makeDefault
          ? async (id: string) => { requireNativePreset(id); return props.makeDefault(id); }
          : props.makeDefault;
        return <StableNativePresetSeat
          Native={Native}
          {...props}
          useAgentPresetSeat={useSeat}
          useShowPresetPicker={useShowPresetPicker}
          useSessionRetainInfo={useSessionRetainInfo}
          select={select}
          makeDefault={makeDefault}
        />;
      }
      dispose = ctx.slots.register({ name: key, priority: -10, locale: 'settings.agentPreset', inject: original.inject } as any, PublicPresets);
    };
    ctx.effect(() => { const stop = ctx.slots.subscribe(key as any, ready); ready(); return () => { stop(); dispose?.(); }; }, 'workdsh.expert-preset-menu.seat');
  };
  install('conversation.hero.agentPreset');
}
