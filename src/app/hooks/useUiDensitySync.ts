import { useEffect } from 'react';
import { useAtomValue } from 'jotai';
import { uiDensityAtom } from '@/app/store/atoms';
import { UI_DENSITY_SIZES, uiDensityVarName, type UiDensitySizes } from '@/theme/uiDensity';

export function useUiDensitySizes(): UiDensitySizes {
  const density = useAtomValue(uiDensityAtom);
  return UI_DENSITY_SIZES[density] ?? UI_DENSITY_SIZES.default;
}

export function useUiDensitySync(): void {
  const sizes = useUiDensitySizes();
  useEffect(() => {
    const root = document.documentElement.style;
    for (const [key, value] of Object.entries(sizes)) {
      root.setProperty(uiDensityVarName(key as keyof UiDensitySizes), `${value}px`);
    }
  }, [sizes]);
}
