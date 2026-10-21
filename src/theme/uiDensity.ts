export type UiDensity = 'compact' | 'default' | 'spacious';

export interface UiDensitySizes {
  roomRow: number;
  roomAvatar: number;
  categoryHeader: number;
  memberRow: number;
  /** Two-line rows (name + status) in the DM list. */
  dmRow: number;
  roleHeader: number;
  spaceGap: number;
}

export const UI_DENSITY_SIZES: Record<UiDensity, UiDensitySizes> = {
  compact: {
    roomRow: 32,
    roomAvatar: 24,
    categoryHeader: 22,
    memberRow: 40,
    dmRow: 40,
    roleHeader: 26,
    spaceGap: 4,
  },
  default: {
    roomRow: 40,
    roomAvatar: 32,
    categoryHeader: 26,
    memberRow: 48,
    dmRow: 48,
    roleHeader: 30,
    spaceGap: 6,
  },
  spacious: {
    roomRow: 48,
    roomAvatar: 36,
    categoryHeader: 32,
    memberRow: 56,
    dmRow: 56,
    roleHeader: 36,
    spaceGap: 10,
  },
};

export function uiDensityVarName(key: keyof UiDensitySizes): string {
  return `--wz-ui-${key}`;
}

export function uiSize(key: keyof UiDensitySizes): string {
  return `var(${uiDensityVarName(key)}, ${UI_DENSITY_SIZES.default[key]}px)`;
}
