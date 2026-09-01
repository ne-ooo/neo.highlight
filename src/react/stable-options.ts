import { useMemo, useRef } from "react";
import type { DiffHighlight } from "../core/types";

function arraysEqual<T>(
  left: readonly T[] | undefined,
  right: readonly T[] | undefined,
): boolean {
  if (left === right) return true;
  if (!left || !right || left.length !== right.length) return false;
  return left.every((item, index) => Object.is(item, right[index]));
}

/** Keep equivalent array options stable without hiding in-place mutations. */
export function useShallowStableArray<T>(
  value: readonly T[] | undefined,
): T[] | undefined {
  const stableRef = useRef<T[] | undefined>(undefined);
  if (!arraysEqual(stableRef.current, value)) {
    stableRef.current = value ? [...value] : undefined;
  }
  return stableRef.current;
}

/** Stabilize the three line lists that make up a diff-highlighting option. */
export function useStableDiffHighlight(
  value: DiffHighlight | undefined,
): DiffHighlight | undefined {
  const added = useShallowStableArray(value?.added);
  const removed = useShallowStableArray(value?.removed);
  const modified = useShallowStableArray(value?.modified);
  const present = value !== undefined;

  return useMemo(
    () => (present ? { added, removed, modified } : undefined),
    [present, added, removed, modified],
  );
}
