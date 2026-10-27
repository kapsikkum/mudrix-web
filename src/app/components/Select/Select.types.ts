export interface SelectOption<T extends string = string> {
  value: T;
  label: string;
  disabled?: boolean;
  /** Heading this option is listed under; consecutive options with the same one share it. */
  group?: string;
}
