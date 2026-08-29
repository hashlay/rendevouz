import React, { useRef, useEffect, useState } from 'react';
import { X, Download, Printer, Settings2, ChevronLeft, ChevronRight } from 'lucide-react';

interface CertificateGeneratorProps {
  participantNames: string[];
  competitionName: string;
  competitionId?: string;
  rank: number;
  eventSettings?: any;
  user: any;
  token: string;
  onClose: () => void;
  onSettingsUpdated?: () => void;
}

const FONT_OPTIONS = [
  { label: 'Montserrat (Modern)', value: '"Montserrat", sans-serif' },
  { label: 'Inter (Sans)', value: '"Inter", sans-serif' },
  { label: 'Outfit (Sans)', value: '"Outfit", sans-serif' },
  { label: 'Playfair Display (Serif)', value: '"Playfair Display", serif' },
  { label: 'Cinzel (Decorative)', value: '"Cinzel", serif' },
  { label: 'Great Vibes (Script)', value: '"Great Vibes", cursive' },
  { label: 'Alex Brush (Script)', value: '"Alex Brush", cursive' },
  { label: 'Pinyon Script (Classic Script)', value: '"Pinyon Script", cursive' },
  { label: 'Roboto (Sans)', value: '"Roboto", sans-serif' },
  { label: 'Poppins (Sans)', value: '"Poppins", sans-serif' }
];

export default function CertificateGenerator({
  participantNames,
  competitionName,
  competitionId,
  rank,
  eventSettings,
  user,
  token,
  onClose,
  onSettingsUpdated
}: CertificateGeneratorProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [currentIndex, setCurrentIndex] = useState(0);
  
  const [dragging, setDragging] = useState<'name' | 'comp' | null>(null);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);
  
  // Customization state - lookup competition-specific config first, then fallback to rank default
  const compKey = `${competitionId || competitionName}_${rank}`;
  const compSpecificConfig = eventSettings?.certificateTemplateConfig?.[compKey];
  const globalRankConfig = eventSettings?.certificateTemplateConfig?.[rank] || {};
  const templateConfig = compSpecificConfig || globalRankConfig;

  const [nameX, setNameX] = useState(templateConfig.nameX ?? (rank === 1 ? -151 : -125));
  const [nameY, setNameY] = useState(templateConfig.nameY ?? (rank === 1 ? 461 : 461));
  const [compX, setCompX] = useState(templateConfig.compX ?? (rank === 1 ? -37 : -30));
  const [compY, setCompY] = useState(templateConfig.compY ?? (rank === 1 ? 553 : 553));
  const [nameSize, setNameSize] = useState(templateConfig.nameSize ?? (rank === 1 ? 33 : 33));
  const [compSize, setCompSize] = useState(templateConfig.compSize ?? (rank === 1 ? 25 : 25));
  
  // Custom text overrides for long names & competition titles
  const [customParticipantNames, setCustomParticipantNames] = useState<Record<number, string>>({});
  const [customCompName, setCustomCompName] = useState<string>(competitionName);

  // Font choices
  const [nameFont, setNameFont] = useState(templateConfig.nameFont || '"Montserrat", "Inter", sans-serif');
  const [compFont, setCompFont] = useState(templateConfig.compFont || '"Montserrat", "Inter", sans-serif');
  
  // Base on rank, pick default colors
  // 1st place has a red/burgundy theme. 2nd and 3rd place use black text.
  const defaultColor = rank === 1 ? '#cc0000' : '#000000';
  
  const [nameColor, setNameColor] = useState(templateConfig.nameColor ?? defaultColor);
  const [compColor, setCompColor] = useState(templateConfig.compColor ?? defaultColor);
  
  const [savingTemplate, setSavingTemplate] = useState(false);

  const [imageLoaded, setImageLoaded] = useState(false);
  const templateImgRef = useRef<HTMLImageElement | null>(null);

  useEffect(() => {
    const img = new Image();
    const customUrl = rank === 1 
      ? eventSettings?.certTheme1Url 
      : rank === 2 
        ? eventSettings?.certTheme2Url 
        : eventSettings?.certTheme3Url;

    const fallbackUrl = rank === 1 ? '/certificate_1.jpg' : '/certificate_2.jpg';
    img.src = customUrl || fallbackUrl;

    img.onload = () => {
      templateImgRef.current = img;
      setImageLoaded(true);
    };
    img.onerror = () => {
      img.src = fallbackUrl;
    };
  }, [rank, eventSettings]);

  const fillMultiLineCanvasText = (
    ctx: CanvasRenderingContext2D,
    rawText: string,
    x: number,
    y: number,
    fontSize: number,
    fontStyle: string,
    color: string,
    transformUpper: boolean = true,
    align: CanvasTextAlign = 'center'
  ) => {
    ctx.fillStyle = color;
    ctx.font = fontStyle;
    ctx.textAlign = align;
    ctx.textBaseline = 'bottom';

    const textStr = transformUpper ? (rawText || '').toUpperCase() : (rawText || '');
    const lines = textStr.split('\n').filter(Boolean);
    if (lines.length <= 1) {
      ctx.fillText(lines[0] || '', x, y);
      return;
    }
    const lineGap = fontSize * 1.15;
    const startY = y - ((lines.length - 1) * lineGap);
    lines.forEach((line, i) => {
      ctx.fillText(line, x, startY + i * lineGap);
    });
  };

  const drawCertificate = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, pName: string, overrideCompName?: string) => {
    // Set canvas size to match image resolution exactly for high quality
    ctx.canvas.width = img.width;
    ctx.canvas.height = img.height;

    // Draw background
    ctx.drawImage(img, 0, 0, img.width, img.height);

    // Center text horizontally
    const centerX = img.width / 2;

    // Draw Name (Centered)
    const displayName = pName || 'PARTICIPANT NAME';
    fillMultiLineCanvasText(
      ctx,
      displayName,
      centerX + nameX,
      nameY,
      nameSize,
      `bold ${nameSize}px ${nameFont}`,
      nameColor,
      true,
      'center'
    );

    // Draw Competition (Left-aligned starting from X coordinate)
    const displayComp = overrideCompName || customCompName || competitionName || 'COMPETITION';
    fillMultiLineCanvasText(
      ctx,
      displayComp,
      centerX + compX,
      compY,
      compSize,
      `bold ${compSize}px ${compFont}`,
      compColor,
      true,
      'left'
    );
  };

  const currentDisplayName = customParticipantNames[currentIndex] ?? participantNames[currentIndex];

  useEffect(() => {
    if (imageLoaded && templateImgRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawCertificate(ctx, templateImgRef.current, currentDisplayName);
    }
  }, [imageLoaded, nameX, nameY, compX, compY, nameSize, compSize, nameColor, compColor, nameFont, compFont, currentDisplayName, customCompName, currentIndex, competitionName]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !templateImgRef.current) return null;
    const rect = canvas.getBoundingClientRect();

    const canvasAspect = canvas.width / canvas.height;
    const rectAspect = rect.width / rect.height;

    let actualWidth = rect.width;
    let actualHeight = rect.height;
    let offsetX = 0;
    let offsetY = 0;

    if (rectAspect > canvasAspect) {
      actualWidth = rect.height * canvasAspect;
      offsetX = (rect.width - actualWidth) / 2;
    } else {
      actualHeight = rect.width / canvasAspect;
      offsetY = (rect.height - actualHeight) / 2;
    }

    const scaleX = canvas.width / actualWidth;
    const scaleY = canvas.height / actualHeight;

    let clientX = 0;
    let clientY = 0;

    if ('touches' in e && e.touches && e.touches.length > 0) {
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else if ('changedTouches' in e && (e as any).changedTouches && (e as any).changedTouches.length > 0) {
      clientX = (e as any).changedTouches[0].clientX;
      clientY = (e as any).changedTouches[0].clientY;
    } else if ('clientX' in e) {
      clientX = (e as React.MouseEvent).clientX;
      clientY = (e as React.MouseEvent).clientY;
    } else {
      return null;
    }

    const imgX = (clientX - rect.left - offsetX) * scaleX;
    const imgY = (clientY - rect.top - offsetY) * scaleY;
    return { imgX, imgY, clientX, clientY };
  };

  const handleDragStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords || !templateImgRef.current) return;
    const { imgX, imgY, clientX, clientY } = coords;

    if (e.cancelable) {
      try { e.preventDefault(); } catch (_) {}
    }

    const centerX = templateImgRef.current.width / 2;
    const nameHit = Math.abs(imgX - (centerX + nameX)) < 350 && imgY > nameY - nameSize - 40 && imgY < nameY + 40;
    const compStartX = centerX + compX;
    const compHit = imgX >= compStartX - 30 && imgX <= compStartX + 500 && imgY > compY - compSize - 40 && imgY < compY + 40;

    if (nameHit) {
      setDragging('name');
      lastMousePos.current = { x: clientX, y: clientY };
    } else if (compHit) {
      setDragging('comp');
      lastMousePos.current = { x: clientX, y: clientY };
    }
  };

  useEffect(() => {
    if (!dragging) return;

    const handleWindowMove = (e: MouseEvent | TouchEvent | PointerEvent) => {
      if (!lastMousePos.current || !templateImgRef.current || !canvasRef.current) return;
      
      let clientX = 0;
      let clientY = 0;

      if ('touches' in e && e.touches && e.touches.length > 0) {
        clientX = e.touches[0].clientX;
        clientY = e.touches[0].clientY;
      } else if ('clientX' in e) {
        clientX = (e as MouseEvent).clientX;
        clientY = (e as MouseEvent).clientY;
      } else {
        return;
      }

      if (e.cancelable) {
        try { e.preventDefault(); } catch (_) {}
      }

      const canvas = canvasRef.current;
      const rect = canvas.getBoundingClientRect();
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      const deltaClientX = clientX - lastMousePos.current.x;
      const deltaClientY = clientY - lastMousePos.current.y;

      const dx = deltaClientX * scaleX;
      const dy = deltaClientY * scaleY;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        if (dragging === 'name') {
          setNameX(prev => Math.round(prev + dx));
          setNameY(prev => Math.round(prev + dy));
        } else if (dragging === 'comp') {
          setCompX(prev => Math.round(prev + dx));
          setCompY(prev => Math.round(prev + dy));
        }
        lastMousePos.current = { x: clientX, y: clientY };
      }
    };

    const handleWindowEnd = () => {
      setDragging(null);
      lastMousePos.current = null;
    };

    window.addEventListener('pointermove', handleWindowMove, { passive: false });
    window.addEventListener('mousemove', handleWindowMove, { passive: false });
    window.addEventListener('touchmove', handleWindowMove, { passive: false });

    window.addEventListener('pointerup', handleWindowEnd);
    window.addEventListener('mouseup', handleWindowEnd);
    window.addEventListener('touchend', handleWindowEnd);

    return () => {
      window.removeEventListener('pointermove', handleWindowMove);
      window.removeEventListener('mousemove', handleWindowMove);
      window.removeEventListener('touchmove', handleWindowMove);

      window.removeEventListener('pointerup', handleWindowEnd);
      window.removeEventListener('mouseup', handleWindowEnd);
      window.removeEventListener('touchend', handleWindowEnd);
    };
  }, [dragging]);

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const currentConfig = eventSettings?.certificateTemplateConfig || {};
      const configData = { nameX, nameY, compX, compY, nameSize, compSize, nameColor, compColor, nameFont, compFont };
      const newConfig = {
        ...currentConfig,
        [compKey]: configData,
        [rank]: configData
      };
      
      const currentOverrides = eventSettings?.certificateOverrides || {};
      const updatedOverrides = { ...currentOverrides };

      participantNames.forEach((origName, idx) => {
        const customName = customParticipantNames[idx];
        if (customName) {
          updatedOverrides[`${compKey}_${idx}`] = customName;
          updatedOverrides[`${compKey}_${origName}`] = customName;
          updatedOverrides[origName] = customName;
        }
      });

      if (customCompName && customCompName !== competitionName) {
        updatedOverrides[`comp_${competitionId || competitionName}`] = customCompName;
        updatedOverrides[`comp_${competitionName}`] = customCompName;
      }

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          certificateTemplateConfig: newConfig,
          certificateOverrides: updatedOverrides
        })
      });
      
      if (!res.ok) throw new Error('Failed to save certificate layout');
      
      alert(`Certificate layout and text overrides for "${competitionName}" (Rank ${rank}) saved successfully!`);
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (err: any) {
      alert('Error saving certificate: ' + err.message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDownload = () => {
    if (!canvasRef.current || !templateImgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Download all participants
    participantNames.forEach((name, index) => {
      setTimeout(() => {
        const pName = customParticipantNames[index] ?? name;
        drawCertificate(ctx, templateImgRef.current!, pName);
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        const link = document.createElement('a');
        link.download = `${pName}_Rank${rank}_Certificate.jpg`;
        link.href = dataUrl;
        link.click();
        
        // Restore to current index view after finishing
        if (index === participantNames.length - 1) {
          setTimeout(() => {
            drawCertificate(ctx, templateImgRef.current!, currentDisplayName);
          }, 500);
        }
      }, index * 300);
    });
  };

  const handlePrint = () => {
    if (!canvasRef.current || !templateImgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate data URLs for all participants
    const dataUrls: string[] = [];
    participantNames.forEach((name, index) => {
      const pName = customParticipantNames[index] ?? name;
      drawCertificate(ctx, templateImgRef.current!, pName);
      dataUrls.push(canvas.toDataURL('image/jpeg', 1.0));
    });
    
    // Restore current view
    drawCertificate(ctx, templateImgRef.current!, currentDisplayName);
    
    const printWindow = window.open('', '_blank');
    if (printWindow) {
      const imgTags = dataUrls.map(url => `<div class="page-break"><img src="${url}" /></div>`).join('');
      printWindow.document.write(`
        <html>
          <head>
            <title>Print Certificates</title>
            <style>
              body { margin: 0; padding: 0; display: flex; flex-direction: column; align-items: center; background: #525659; gap: 20px; padding: 20px; }
              img { max-width: 100%; max-height: 100vh; object-fit: contain; box-shadow: 0 4px 12px rgba(0,0,0,0.5); display: block; }
              .page-break { page-break-after: always; display: flex; justify-content: center; }
              @media print {
                @page { size: landscape; margin: 0 !important; }
                body { background: white; margin: 0; padding: 0; display: block; }
                .page-break { display: block; page-break-after: always; margin: 0; padding: 0; }
                img { width: 100vw; height: 100vh; max-height: 100vh; object-fit: cover; box-shadow: none; margin: 0; padding: 0; display: block; }
              }
            </style>
          </head>
          <body>
            ${imgTags}
            <script>
              window.onload = () => {
                setTimeout(() => {
                  window.print();
                  window.close();
                }, 500);
              };
            </script>
          </body>
        </html>
      `);
      printWindow.document.close();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 font-sans ">
      <div className="bg-white rounded-3xl shadow-lg w-full max-w-5xl overflow-hidden flex flex-col md:flex-row max-h-[90vh]">
        
        {/* Left: Preview */}
        <div className="w-full md:flex-1 bg-slate-100 p-3 sm:p-6 flex flex-col items-center justify-center border-b md:border-b-0 md:border-r border-slate-200 shrink-0 min-h-0 relative">
          <div className="mb-2 text-xs text-slate-500 font-medium flex items-center gap-2 shrink-0">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            Drag & drop text on certificate preview to position
          </div>
          
          <div className="relative shadow-xl border-2 border-white rounded-lg overflow-hidden bg-white max-w-full flex items-center justify-center shrink-0">
            <canvas 
              ref={canvasRef} 
              className="w-auto h-auto max-h-[45vh] md:max-h-[65vh] max-w-full object-contain cursor-move touch-none"
              onPointerDown={handleDragStart}
              onTouchStart={handleDragStart}
              onMouseDown={handleDragStart}
            />
          </div>
        </div>

        {/* Right: Controls Sidebar */}
        <div className="w-full md:w-80 lg:w-96 bg-white p-6 overflow-y-auto flex flex-col max-h-[45vh] md:max-h-full justify-between shrink-0">
          
          {participantNames.length > 1 && (
            <div className="flex items-center justify-between bg-slate-50 p-2 rounded-xl mb-4 border border-slate-200">
              <button 
                onClick={() => setCurrentIndex(prev => Math.max(0, prev - 1))}
                disabled={currentIndex === 0}
                className="p-1.5 hover:bg-white rounded-lg text-slate-500 disabled:opacity-30 shadow-sm"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <div className="text-xs font-bold text-slate-700">
                Team Member {currentIndex + 1} of {participantNames.length}
              </div>
              <button 
                onClick={() => setCurrentIndex(prev => Math.min(participantNames.length - 1, prev + 1))}
                disabled={currentIndex === participantNames.length - 1}
                className="p-1.5 hover:bg-white rounded-lg text-slate-500 disabled:opacity-30 shadow-sm"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          )}

          <div className="space-y-6 flex-1">
            {/* Participant Name Controls */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Participant Name Settings</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Edit / Shorten Display Name (Enter key for 2 lines)</label>
                <textarea
                  rows={2}
                  value={customParticipantNames[currentIndex] ?? participantNames[currentIndex] ?? ''}
                  onChange={(e) => setCustomParticipantNames(prev => ({ ...prev, [currentIndex]: e.target.value }))}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                  placeholder="Override name... Press Enter for 2 lines"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Font Family</label>
                <select
                  value={nameFont}
                  onChange={(e) => setNameFont(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                >
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div>
                <label className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Font Size</span>
                  <span className="font-mono">{nameSize}px</span>
                </label>
                <input 
                  type="range" min="20" max="80" value={nameSize} 
                  onChange={(e) => setNameSize(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Horizontal Position (X)</span>
                  <span className="font-mono">{nameX}</span>
                </label>
                <input 
                  type="range" min="-500" max="500" value={nameX} 
                  onChange={(e) => setNameX(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Vertical Position (Y)</span>
                  <span className="font-mono">{nameY}</span>
                </label>
                <input 
                  type="range" min="200" max="1500" value={nameY} 
                  onChange={(e) => setNameY(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Color</label>
                <input 
                  type="color" value={nameColor} 
                  onChange={(e) => setNameColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border border-slate-200"
                />
              </div>
            </div>

            {/* Competition Controls */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Competition Name Settings</h3>
              
              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Edit / Shorten Competition Name (Enter key for 2 lines)</label>
                <textarea
                  rows={2}
                  value={customCompName}
                  onChange={(e) => setCustomCompName(e.target.value)}
                  className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-bold focus:ring-2 focus:ring-emerald-500"
                  placeholder="Override competition name... Press Enter for 2 lines"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 mb-1">Font Family</label>
                <select
                  value={compFont}
                  onChange={(e) => setCompFont(e.target.value)}
                  className="w-full px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold focus:ring-2 focus:ring-emerald-500"
                >
                  {FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                </select>
              </div>

              <div>
                <label className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Font Size</span>
                  <span className="font-mono">{compSize}px</span>
                </label>
                <input 
                  type="range" min="16" max="60" value={compSize} 
                  onChange={(e) => setCompSize(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Horizontal Position (X)</span>
                  <span className="font-mono">{compX}</span>
                </label>
                <input 
                  type="range" min="-500" max="500" value={compX} 
                  onChange={(e) => setCompX(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="flex justify-between text-xs text-slate-500 mb-1">
                  <span>Vertical Position (Y)</span>
                  <span className="font-mono">{compY}</span>
                </label>
                <input 
                  type="range" min="200" max="1500" value={compY} 
                  onChange={(e) => setCompY(Number(e.target.value))}
                  className="w-full accent-emerald-600"
                />
              </div>

              <div>
                <label className="block text-xs text-slate-500 mb-1">Color</label>
                <input 
                  type="color" value={compColor} 
                  onChange={(e) => setCompColor(e.target.value)}
                  className="w-full h-8 rounded cursor-pointer border border-slate-200"
                />
              </div>
            </div>
          </div>

          <div className="mt-6 space-y-3">
            <button 
              onClick={handlePrint}
              disabled={!imageLoaded}
              className="w-full flex items-center justify-center gap-2 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-colors disabled:opacity-50"
            >
              <Printer className="w-5 h-5" />
              {participantNames.length > 1 ? 'Print All Certificates' : 'Print Certificate'}
            </button>
            <button 
              onClick={handleDownload}
              disabled={!imageLoaded}
              className="w-full flex items-center justify-center gap-2 py-3 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-emerald-600/20 disabled:opacity-50"
            >
              <Download className="w-5 h-5" />
              {participantNames.length > 1 ? 'Download All JPGs' : 'Download JPG'}
            </button>
            {user?.role === 'super_admin' && (
              <button 
                onClick={handleSaveTemplate}
                disabled={savingTemplate}
                className="w-full flex items-center justify-center gap-2 py-3 bg-purple-600 hover:bg-purple-700 text-white rounded-xl font-bold transition-colors shadow-lg shadow-purple-600/20 disabled:opacity-50 mt-2"
              >
                <Settings2 className="w-5 h-5" />
                {savingTemplate ? 'Saving...' : 'Save Certificate'}
              </button>
            )}
            
            <button 
              onClick={onClose}
              className="w-full flex items-center justify-center gap-2 py-3 bg-white hover:bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold transition-colors mt-2"
            >
              <X className="w-5 h-5" />
              Cancel & Go Back
            </button>
          </div>

        </div>
      </div>
    </div>
  );
}
