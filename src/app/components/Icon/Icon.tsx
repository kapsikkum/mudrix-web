import type { Icon as PhosphorIcon } from '@phosphor-icons/react';

interface IconProps {
  icon: PhosphorIcon;
  size?: number;
  className?: string;
  style?: React.CSSProperties;
  spin?: boolean;
  weight?: 'thin' | 'light' | 'regular' | 'bold' | 'fill' | 'duotone';
}

export function Icon({
  icon: IconComponent,
  size = 16,
  className,
  style,
  spin,
  weight = 'regular',
}: IconProps) {
  const combined = [spin ? 'icon-spin' : '', className].filter(Boolean).join(' ') || undefined;
  return <IconComponent size={size} className={combined} style={style} weight={weight} />;
}
