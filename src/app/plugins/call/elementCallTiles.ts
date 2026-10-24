export const VIDEO_TILE_SELECTOR = '[data-testid="videoTile"]';

export type TileVm = Record<string, unknown>;

export function getFiberFromNode(node: Element): Record<string, unknown> | null {
  const anyNode = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(anyNode)) {
    if (key.startsWith('__reactFiber$')) {
      return anyNode[key] as Record<string, unknown>;
    }
  }
  return null;
}

export function findMediaVm(fiber: Record<string, unknown> | null): TileVm | null {
  let current = fiber;
  while (current) {
    const props = current.memoizedProps as Record<string, unknown> | undefined;
    const vm = props?.vm as TileVm | undefined;
    if (
      vm &&
      typeof vm === 'object' &&
      (vm.audioEnabled$ || vm.videoEnabled$ || (vm.type as unknown) === 'screen share') &&
      vm.userId
    ) {
      return vm;
    }
    current = current.return as Record<string, unknown> | null;
  }
  return null;
}

/**
 * Our Element Call fork stamps tiles with `data-mx-media-id` and keeps each tile's view model in
 * `window.mudrixMedia` (element-call/src/mudrix/bridge.ts). The upstream npm package has neither,
 * so we fall back to reading the view model out of React's fiber tree.
 */
export function getTileVm(tile: Element): TileVm | null {
  const id = (tile as HTMLElement).dataset?.mxMediaId;
  const media = (tile.ownerDocument.defaultView as { mudrixMedia?: Map<string, TileVm> } | null)
    ?.mudrixMedia;
  if (id && media) {
    const vm = media.get(id);
    if (vm) return vm;
  }
  return findMediaVm(getFiberFromNode(tile));
}

export function isScreenShareVm(vm: TileVm): boolean {
  return (vm.type as unknown) === 'screen share';
}

export function readObservable(ob: unknown): unknown {
  if (!ob) return undefined;
  const value = ob as { getValue?: () => unknown; value?: unknown };
  try {
    if (typeof value.getValue === 'function') return value.getValue();
    if ('value' in value) return value.value;
  } catch {
    // ignore
  }
  return undefined;
}

export function subscribeObservable(
  ob: unknown,
  callback: (value: unknown) => void
): (() => void) | null {
  const source = ob as
    | { subscribe?: (next: (value: unknown) => void) => { unsubscribe: () => void } }
    | undefined;
  if (typeof source?.subscribe !== 'function') return null;
  try {
    const subscription = source.subscribe(callback);
    return () => subscription.unsubscribe();
  } catch {
    return null;
  }
}
