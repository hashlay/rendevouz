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
  title = 'RENDEZVOUS',
  subtitle = '26',
  badge = 'IMAM RABBANI LIFE FESTIVAL',
  showIcon = true,
  customIconUrl = '',
}) => {
  // Dimension scales
  const scales = {
    sm: { iconSize: 32, textSize: 'text-sm', subTextSize: 'text-[9px]' },
    md: { iconSize: 42, textSize: 'text-base', subTextSize: 'text-[10px]' },
    lg: { iconSize: 52, textSize: 'text-xl', subTextSize: 'text-xs' },
    xl: { iconSize: 80, textSize: 'text-3xl', subTextSize: 'text-sm' },
  };

  const { iconSize, textSize, subTextSize } = scales[size];

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Brand Icon */}
      {showIcon && (
        <div className="relative group shrink-0 flex items-center justify-center">
          <img
            src={customIconUrl || '/rendezvous_icon.png'}
            alt="Logo Icon"
            onError={(e) => {
              const target = e.currentTarget;
              if (!target.src.endsWith('/rendezvous_icon.png')) {
                target.src = '/rendezvous_icon.png';
              }
            }}
            className="object-contain rounded-xl shadow-md transition-transform duration-300 group-hover:scale-105"
            style={{ width: iconSize, height: iconSize }}
          />
        </div>
      )}

      {variant !== 'icon' && (
        <div className="flex flex-col justify-center items-start text-left">
          <div className="flex flex-col leading-none tracking-tight items-start">
            <span className={`font-black uppercase text-white ${textSize} ${title.toUpperCase().includes('RENDEZVOUS') ? 'font-hochland text-[1.15em] tracking-wider' : 'font-sans tracking-tight'}`}>
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
