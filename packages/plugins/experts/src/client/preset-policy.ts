/** Compiled expert presets require an execution binding and are never native choices. */
export function isNativePreset(id: string): boolean { return !id.startsWith('wd-exp-'); }
export function nativePresetRows<T extends { id: string }>(rows: readonly T[]): readonly T[] {
  return rows.filter(row => isNativePreset(row.id));
}
export function requireNativePreset(id: string): void {
  if (!isNativePreset(id)) throw new Error('请从数字员工中心召唤数字员工；内部数字员工配置不能作为普通对话或默认配置。');
}
/** Prefer official standard mode when clearing a summoned expert; otherwise the first native row. */
export function preferredNativePresetId(rows: readonly { id: string }[]): string | undefined {
  const native = nativePresetRows(rows);
  return native.find(row => row.id === 'standard')?.id ?? native[0]?.id;
}
