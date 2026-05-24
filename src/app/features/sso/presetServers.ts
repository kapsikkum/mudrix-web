export interface PresetServer {
  label: string;
  value: string;
}

export const PRESET_SERVERS: PresetServer[] = [
  { label: 'matrix.org', value: 'https://matrix.org' },
  { label: 'mozilla.org', value: 'https://mozilla.modular.im' },
];
