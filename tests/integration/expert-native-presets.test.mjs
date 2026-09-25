import test from 'node:test';
import assert from 'node:assert/strict';
import { isNativePreset, nativePresetRows, preferredNativePresetId, requireNativePreset } from '../../packages/plugins/experts/dist/client/preset-policy.js';
test('native new-session and default menus exclude every compiled expert including public leads', () => {
  const rows = [{id:'dsh-base'}, {id:'custom'}, {id:'wd-exp-work-retrospective-advisor-123'}, {id:'wd-exp-member-123'}];
  assert.deepEqual(nativePresetRows(rows), rows.slice(0,2));
  assert.equal(isNativePreset('wd-exp-public-team'), false);
  assert.throws(() => requireNativePreset(rows[2].id), /召唤数字员工/);
  assert.doesNotThrow(() => requireNativePreset('dsh-base'));
  assert.equal(preferredNativePresetId([{id:'ptc'},{id:'standard'},{id:'wd-exp-x'}]), 'standard');
  assert.equal(preferredNativePresetId([{id:'dsh-base'},{id:'wd-exp-x'}]), 'dsh-base');
  assert.equal(preferredNativePresetId([{id:'wd-exp-x'}]), undefined);
});

import { installExpertPresetMenu } from '../../packages/plugins/experts/dist/client/PresetMenu.js';
test('native new-session Slot adapter filters the roster and refuses internal select mutations', async () => {
  const registrations = [];
  const ctx = { slots: {
    entriesOfSlot: () => [{ options: {}, inject: () => ({}), component: 'native-preset' }],
    register: (options, component) => { registrations.push({options, component}); return () => {}; },
    subscribe: () => () => {},
  }, effect: callback => callback() };
  installExpertPresetMenu(ctx, {});
  assert.equal(registrations.length, 1);
  // Regression: 'settings.section' is an additive list slot — re-registering it (same id or not)
  // rendered a second "Agent 预设" page next to the Harness-owned one.
  assert.ok(registrations.every(entry => entry.options.name !== 'settings.section'));
  const rows = [{id:'dsh-base'}, {id:'wd-exp-public-expert'}];
  let writes = 0;
  let defaultWrites = 0;
  const seat = registrations[0].component({
    useAgentPresetSeat: selector => selector({ options: rows, showPicker: true, current: 'dsh-base' }),
    useShowPresetPicker: selector => selector(false), // official developerTools gate (off after hard refresh)
    select: async () => { writes++; },
    makeDefault: async () => { defaultWrites++; },
  });
  assert.deepEqual(seat.props.useAgentPresetSeat(s => s.options), rows.slice(0,1));
  // Product seat follows modeSelectionEnabled (showPicker), not developerTools.
  assert.equal(seat.props.useShowPresetPicker(v => v), true);
  await assert.rejects(seat.props.select(rows[1].id), /召唤数字员工/);
  assert.equal(writes, 0);
  await assert.rejects(seat.props.makeDefault(rows[1].id), /召唤数字员工/);
  assert.equal(defaultWrites, 0);
  await seat.props.select('dsh-base');
  assert.equal(writes, 1);
  await seat.props.makeDefault('dsh-base');
  assert.equal(defaultWrites, 1);
});

test('hero mode chip stays visible past developerTools and mainView retain races after hard refresh', () => {
  let Seat;
  const ctx = { slots: {
    entriesOfSlot: () => [{ options: {}, inject: () => ({}), component: 'native-preset' }],
    register: (_, component) => { Seat = component; return () => {}; },
    subscribe: () => () => {},
  }, effect: callback => callback() };
  installExpertPresetMenu(ctx, {});
  const seat = Seat({
    useAgentPresetSeat: selector => selector({ options: [{ id: 'standard' }], showPicker: false, current: 'standard' }),
    useShowPresetPicker: selector => selector(false),
    useSessionRetainInfo: selector => selector({ retainedBy: {} }),
  });
  assert.equal(seat.props.useShowPresetPicker(v => v), true);
  assert.equal(seat.props.useAgentPresetSeat(s => s.showPicker), true);
  assert.equal(seat.props.useSessionRetainInfo(info => (info?.retainedBy.mainView ?? 0) > 0), true);
});

test('summoned expert keeps the authored roster and can clear back to standard', async () => {
  let Seat;
  const ctx = {slots:{entriesOfSlot: () => [{options:{},inject:()=>({}),component:'native'}], subscribe:()=>()=>{},register:(_,component)=>{Seat=component;return ()=>{};}},effect:fn=>fn()};
  installExpertPresetMenu(ctx, {});
  const rows=[{id:'standard',name:'标准模式'},{id:'wd-exp-finance',name:'公司财务专家团'}];
  let selected;
  const element=Seat({
    useAgentPresetSeat:selector=>selector({current:'wd-exp-finance',options:rows}),
    load: async () => {},
    select: async (id) => { selected = id; },
  });
  assert.notEqual(element.type, 'native');
  assert.equal(element.props.useAgentPresetSeat(s => s.options)[1].name, '公司财务专家团');
  assert.equal(preferredNativePresetId(rows), 'standard');
  await element.props.select('standard');
  assert.equal(selected, 'standard');
});
