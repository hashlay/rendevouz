import React from 'react';

interface LogoProps {
  className?: string;
  showSubBadge?: boolean;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  variant?: 'full' | 'icon' | 'watermark';
  title?: string;
  subtitle?: string;
  badge?: string;
  showIcon?: boolean;
  customIconUrl?: string;
}

export const Logo: React.FC<LogoProps> = ({
  className = '',
  showSubBadge = true,
  size = 'md',
  variant = 'full',
  title = 'At-Tabassum',
  subtitle = 'Meelad Fest',
  badge = 'NOORUL ISLAM MADRASA',
  showIcon = true,
  customIconUrl = '',
}) => {
  // Dimension scales
  const scales = {
    sm: { iconWidth: 42, iconHeight: 24, textSize: 'text-sm', subTextSize: 'text-[9px]' },
    md: { iconWidth: 56, iconHeight: 32, textSize: 'text-base', subTextSize: 'text-[10px]' },
    lg: { iconWidth: 80, iconHeight: 46, textSize: 'text-xl', subTextSize: 'text-xs' },
    xl: { iconWidth: 120, iconHeight: 68, textSize: 'text-3xl', subTextSize: 'text-sm' },
  };

  const { iconWidth, iconHeight, textSize, subTextSize } = scales[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Brand Icon */}
      {showIcon && (
        <div className="relative group shrink-0 flex items-center justify-center">
          <img
            src={customIconUrl || '/tabassum_logo.jpg'}
            alt="Logo Icon"
            onError={(e) => {
              const target = e.currentTarget;
              if (target.src.includes('tabassum_logo.jpg')) {
                target.src = '/tabassum_logo.png';
              }
            }}
            className="object-contain rounded-full shadow-md transition-transform duration-300 group-hover:scale-105"
            style={{ width: iconWidth, height: iconHeight }}
          />
        </div>
      )}

      {variant !== 'icon' && (
        <div className="flex flex-col justify-center items-start text-left">
          <div className="flex flex-col leading-none tracking-tight items-start">
            <span className={`font-black uppercase tracking-tight text-white ${textSize} font-sans`}>
              {title}
            </span>
            <span className={`font-semibold tracking-wide text-zinc-300 ${textSize} opacity-90`}>
              {subtitle}
            </span>
          </div>

          {showSubBadge && (
            <div className="flex items-center justify-start gap-1.5 mt-1 w-full">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#C89A4B] shrink-0 animate-pulse" />
              <span className={`uppercase font-medium tracking-wider text-[#C89A4B] ${subTextSize} text-left`}>
                {badge}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
