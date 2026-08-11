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
  title = 'Rendezvous',
  subtitle = 'Silver Edition',
  badge = 'KULLIYATHU IMAM RABBANI',
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

  // 17 vertical parallel wavy lines forming a solid rectangular block
  const linesCount = 17;
  const svgWidth = 120;
  const svgHeight = 65;
  const paddingX = 6;
  const availableWidth = svgWidth - paddingX * 2;
  const spacing = availableWidth / (linesCount - 1);

  // Generate path d for vertical wave line
  const generateWaveLine = (xIndex: number) => {
    const x = paddingX + xIndex * spacing;
    // Straight top section (barcode-like) then a slight wiggle at the bottom
    return `M ${x} 3 L ${x} 40 C ${x + 3.5} 48, ${x - 3.5} 55, ${x} 62`;
  };

  return (
    <div className={`flex items-center gap-3 select-none ${className}`}>
      {/* Wave Icon */}
      {showIcon && (
        <div className="relative group shrink-0">
          {customIconUrl ? (
            <img 
              src={customIconUrl} 
              alt="Logo Icon" 
              className="object-contain" 
              style={{ width: iconWidth, height: iconHeight }} 
            />
          ) : (
            <svg
              width={iconWidth}
              height={iconHeight}
              viewBox={`0 0 ${svgWidth} ${svgHeight}`}
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
              className="transition-transform duration-300 group-hover:scale-105"
            >
              {Array.from({ length: linesCount }).map((_, i) => (
                <path
                  key={i}
                  d={generateWaveLine(i)}
                  stroke="#FF2B2B"
                  strokeWidth="3.2"
                  strokeLinecap="round"
                />
              ))}
            </svg>
          )}
          {/* Subtle crimson ambient glow */}
          <div className="absolute inset-0 bg-[#FF2B2B]/20 blur-lg rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
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
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF2B2B] shrink-0 animate-pulse" />
              <span className={`uppercase font-medium tracking-wider text-[#E60000] ${subTextSize} text-left`}>
                {badge}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
