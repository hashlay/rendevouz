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
  const rawTitle = (title !== undefined && title !== null && title !== '') ? title : 'RENDEZVOUS 26';
  const rawSubtitle = (subtitle !== undefined && subtitle !== null && subtitle !== '') ? subtitle : '';
  const rawBadge = (badge !== undefined && badge !== null && badge !== '') ? badge : '';

  // Check if subtitle is simply edition number '26'
  const isSubtitleEdition = rawSubtitle.trim() === '26' || rawSubtitle.trim().toUpperCase() === 'RENDEZVOUS 26';
  
  // Secondary text to display under brand
  const effectiveSubtitle = isSubtitleEdition 
    ? (rawBadge || (showSubBadge ? 'IMAM RABBANI LIFE FESTIVAL' : ''))
    : (rawSubtitle || (showSubBadge ? rawBadge : ''));

  // Dimension scales
  const scales = {
    sm: { iconSize: 38, brandSize: 'text-2xl sm:text-[28px]', subTextSize: 'text-[10px]', gap: 'gap-2.5' },
    md: { iconSize: 46, brandSize: 'text-3xl sm:text-[35px]', subTextSize: 'text-xs', gap: 'gap-3' },
    lg: { iconSize: 52, brandSize: 'text-3xl sm:text-[38px]', subTextSize: 'text-xs', gap: 'gap-3.5' },
    xl: { iconSize: 76, brandSize: 'text-4xl sm:text-5xl', subTextSize: 'text-sm', gap: 'gap-4' },
  };

  const { iconSize, brandSize, subTextSize, gap } = scales[size];
  const isRendezvousBrand = rawTitle.toUpperCase().includes('RENDEZVOUS');

  return (
    <div className={`flex items-center ${gap} select-none ${className}`}>
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
          {/* Brand Wordmark */}
          {isRendezvousBrand ? (
            <div className={`flex items-baseline font-hochland uppercase leading-none tracking-normal transform scale-y-[1.06] origin-left ${brandSize}`}>
              <span className="text-white drop-shadow-sm">RENDEZVOUS</span>
              <span className="ml-1.5 font-hochland" style={{ color: 'var(--color-primary-accent, #18BA46)' }}>
                26
              </span>
            </div>
          ) : (
            <span className={`font-black uppercase text-white font-sans tracking-tight leading-none ${brandSize}`}>
              {rawTitle}
            </span>
          )}

          {/* Subtitle / Institution Badge */}
          {effectiveSubtitle && (
            <div className="flex items-center justify-start gap-1.5 mt-1 w-full">
              {showSubBadge && (
                <span className="inline-block w-1.5 h-1.5 rounded-full shrink-0 animate-pulse" style={{ backgroundColor: 'var(--color-primary-accent, #18BA46)' }} />
              )}
              <span className={`uppercase font-bold tracking-wider ${subTextSize} text-left opacity-90`} style={{ color: showSubBadge ? 'var(--color-primary-accent, #18BA46)' : '#d4d4d8' }}>
                {effectiveSubtitle}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
