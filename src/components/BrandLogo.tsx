import { APP_LOGO_SRC } from '../lib/app-config';
import { cn } from '../lib/utils';

export function BrandLogo({
  className,
  size = 40,
}: {
  className?: string;
  size?: number;
}) {
  return (
    <img
      src={APP_LOGO_SRC}
      alt="Roxy Tailor"
      width={size}
      height={size}
      className={cn('object-contain bg-white', className)}
      draggable={false}
    />
  );
}
