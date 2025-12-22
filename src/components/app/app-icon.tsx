import { getAppIcon } from '@/lib/app-icons';

interface AppIconProps {
  wingetId: string;
  className?: string;
}

export function AppIcon({ wingetId, className = 'h-4 w-4' }: AppIconProps) {
  const Icon = getAppIcon(wingetId);
  return <Icon className={className} />;
}
