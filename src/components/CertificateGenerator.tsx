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
    // 1st place -> certTheme1Url || /certificate_1.jpg
    // 2nd place -> certTheme2Url || /certificate_2.jpg
    // 3rd place -> certTheme3Url || /certificate_3.jpg || /certificate_2.jpg
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
      // Fallback if custom URL fails to load
      img.src = fallbackUrl;
    };
  }, [rank, eventSettings]);

  const drawCertificate = (ctx: CanvasRenderingContext2D, img: HTMLImageElement, pName: string) => {
    // Set canvas size to match image resolution exactly for high quality
    ctx.canvas.width = img.width;
    ctx.canvas.height = img.height;

    // Draw background
    ctx.drawImage(img, 0, 0, img.width, img.height);

    // We want to center the text horizontally.
    const centerX = img.width / 2;

    // Draw Name
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = nameColor;
    
    ctx.font = `bold ${nameSize}px "Montserrat", "Inter", sans-serif`;
    ctx.fillText(pName.toUpperCase(), centerX + nameX, nameY);

    // Draw Competition
    ctx.fillStyle = compColor;
    ctx.font = `bold ${compSize}px "Montserrat", "Inter", sans-serif`;
    ctx.fillText(competitionName.toUpperCase(), centerX + compX, compY);
  };

  useEffect(() => {
    if (imageLoaded && templateImgRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawCertificate(ctx, templateImgRef.current, participantNames[currentIndex]);
    }
  }, [imageLoaded, nameX, nameY, compX, compY, nameSize, compSize, nameColor, compColor, participantNames, currentIndex, competitionName]);

  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !templateImgRef.current) return null;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

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

    const imgX = (clientX - rect.left) * scaleX;
    const imgY = (clientY - rect.top) * scaleY;
    return { imgX, imgY };
  };

  const handleDragStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords || !templateImgRef.current) return;
    const { imgX, imgY } = coords;

    if ('pointerId' in e) {
      try {
        (e.target as HTMLElement).setPointerCapture((e as React.PointerEvent).pointerId);
      } catch (_) {}
    }

    const centerX = templateImgRef.current.width / 2;
    const nameHit = Math.abs(imgX - (centerX + nameX)) < 350 && imgY > nameY - nameSize - 35 && imgY < nameY + 35;
    const compHit = Math.abs(imgX - (centerX + compX)) < 350 && imgY > compY - compSize - 35 && imgY < compY + 35;

    if (nameHit) {
      setDragging('name');
      lastMousePos.current = { x: imgX, y: imgY };
    } else if (compHit) {
      setDragging('comp');
      lastMousePos.current = { x: imgX, y: imgY };
    }
  };

  const handleDragMove = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    if (!dragging || !lastMousePos.current || !templateImgRef.current || !canvasRef.current) return;
    const coords = getCanvasCoords(e);
    if (!coords) return;
    const { imgX, imgY } = coords;

    if ('touches' in e) {
      try { e.preventDefault(); } catch (_) {}
    }

    const dx = imgX - lastMousePos.current.x;
    const dy = imgY - lastMousePos.current.y;

    if (dragging === 'name') {
      setNameX(prev => Math.round(prev + dx));
      setNameY(prev => Math.round(prev + dy));
    } else if (dragging === 'comp') {
      setCompX(prev => Math.round(prev + dx));
      setCompY(prev => Math.round(prev + dy));
    }

    lastMousePos.current = { x: imgX, y: imgY };
  };

  const handleDragEnd = (e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    if (e && 'pointerId' in e) {
      try {
        (e.target as HTMLElement).releasePointerCapture((e as React.PointerEvent).pointerId);
      } catch (_) {}
    }
    setDragging(null);
    lastMousePos.current = null;
  };

  const handleSaveTemplate = async () => {
    setSavingTemplate(true);
    try {
      const currentConfig = eventSettings?.certificateTemplateConfig || {};
      const configData = { nameX, nameY, compX, compY, nameSize, compSize, nameColor, compColor };
      const newConfig = {
        ...currentConfig,
        [compKey]: configData,
        [rank]: configData
      };
      
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ certificateTemplateConfig: newConfig })
      });
      
      if (!res.ok) throw new Error('Failed to save certificate layout');
      
      alert(`Certificate layout for "${competitionName}" (Rank ${rank}) saved!`);
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
        drawCertificate(ctx, templateImgRef.current!, name);
        const dataUrl = canvas.toDataURL('image/jpeg', 1.0);
        const link = document.createElement('a');
        link.download = `${name}_Rank${rank}_Certificate.jpg`;
        link.href = dataUrl;
        link.click();
        
        // Restore to current index view after finishing
        if (index === participantNames.length - 1) {
          setTimeout(() => {
            drawCertificate(ctx, templateImgRef.current!, participantNames[currentIndex]);
          }, 500);
        }
      }, index * 300); // 300ms delay between downloads to prevent browser blocking
    });
  };

  const handlePrint = () => {
    if (!canvasRef.current || !templateImgRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Generate data URLs for all participants
    const dataUrls: string[] = [];
    participantNames.forEach((name) => {
      drawCertificate(ctx, templateImgRef.current!, name);
      dataUrls.push(canvas.toDataURL('image/jpeg', 1.0));
    });
    
    // Restore current view
    drawCertificate(ctx, templateImgRef.current!, participantNames[currentIndex]);
    
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
          {!imageLoaded ? (
            <div className="flex flex-col items-center text-slate-400 py-6">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-slate-400 mb-4"></div>
              Loading template...
            </div>
          ) : (
            <div className="relative shadow-sm border border-slate-200 rounded-xl overflow-hidden bg-white max-w-full flex items-center justify-center shrink-0">
              <canvas 
                ref={canvasRef} 
                className="w-auto h-auto max-h-[30vh] sm:max-h-[40vh] md:max-h-[70vh] max-w-full object-contain cursor-move touch-none select-none"
                onMouseDown={handleDragStart}
                onMouseMove={handleDragMove}
                onMouseUp={handleDragEnd}
                onMouseLeave={handleDragEnd}
                onTouchStart={handleDragStart}
                onTouchMove={handleDragMove}
                onTouchEnd={handleDragEnd}
                onPointerDown={handleDragStart}
                onPointerMove={handleDragMove}
                onPointerUp={handleDragEnd}
                onPointerCancel={handleDragEnd}
              />
            </div>
          )}
        </div>

        {/* Right: Controls */}
        <div className="w-full md:w-80 bg-white p-4 sm:p-6 overflow-y-auto flex flex-col max-h-[55vh] md:max-h-full">
          <div className="flex justify-between items-center mb-6 border-b pb-4">
            <div>
              <h2 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                <Settings2 className="w-5 h-5 text-emerald-600" />
                Customize
              </h2>
              <p className="text-[10px] text-slate-500 mt-1 uppercase tracking-wider font-bold">Rank {rank} Certificate</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-slate-100 rounded-full text-slate-500 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {participantNames.length > 1 && (
            <div className="flex items-center justify-between bg-slate-50 p-3 rounded-2xl border border-slate-100 mb-6">
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
            {/* Name Controls */}
            <div className="space-y-3 bg-slate-50 p-4 rounded-2xl border border-slate-100">
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Participant Name</h3>
              
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
              <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider">Competition Name</h3>
              
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
