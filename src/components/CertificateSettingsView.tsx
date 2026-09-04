import React, { useState, useRef, useEffect } from 'react';
import { UserRole } from '../types';
import { Save } from 'lucide-react';
import { UNIVERSAL_FONT_OPTIONS, parseFontForCanvas } from '../utils/fontHelper';

const getBgHash = (bg: string) => { if (!bg || typeof bg !== 'string') return ''; return bg.length > 200 ? `hash_${bg.length}_${bg.slice(-30)}` : bg; };

export default function CertificateSettingsView({ user, token, eventSettings, onSettingsUpdated }: any) {
  const [loading, setLoading] = useState(false);
  const ranks = [1, 2, 3];
  
  const [config, setConfig] = useState<any>(eventSettings?.certificateTemplateConfig || {});
  const [selectedRank, setSelectedRank] = useState(1);
  
  const [certTheme1Url, setCertTheme1Url] = useState(eventSettings?.certTheme1Url || '');
  const [certTheme2Url, setCertTheme2Url] = useState(eventSettings?.certTheme2Url || '');
  const [certTheme3Url, setCertTheme3Url] = useState(eventSettings?.certTheme3Url || '');
  
  const handleUpdate = (rank: number, key: string, value: any) => {
    setConfig((prev: any) => ({
      ...prev,
      [rank]: {
        ...(prev[rank] || {}),
        [key]: value
      }
    }));
  };

  const handleSave = async () => {
    setLoading(true);
    try {
      const finalConfig = { ...config };
      [1, 2, 3].forEach(r => {
        if (finalConfig[r]) {
          const bg = r === 1 ? certTheme1Url : r === 2 ? certTheme2Url : certTheme3Url;
          finalConfig[r] = { ...finalConfig[r], _savedBgImageUrl: getBgHash(bg || (r === 1 ? '/certificate_1.jpg' : '/certificate_2.jpg')) };
        }
      });
      
      const payload: any = { certificateTemplateConfig: finalConfig };
      if (certTheme1Url !== eventSettings?.certTheme1Url) payload.certTheme1Url = certTheme1Url;
      if (certTheme2Url !== eventSettings?.certTheme2Url) payload.certTheme2Url = certTheme2Url;
      if (certTheme3Url !== eventSettings?.certTheme3Url) payload.certTheme3Url = certTheme3Url;

      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify(payload)
      });
      alert('Certificate layout saved successfully!');
      if (onSettingsUpdated) onSettingsUpdated();
    } catch (e) {
      alert('Failed to save layout');
    }
    setLoading(false);
  };

  const currentConf = config[selectedRank] || {};
  const nameX = currentConf.nameX ?? (selectedRank === 1 ? -151 : -125);
  const nameY = currentConf.nameY ?? 461;
  const compX = currentConf.compX ?? (selectedRank === 1 ? -37 : -30);
  const compY = currentConf.compY ?? 553;
  const nameSize = currentConf.nameSize ?? 33;
  const compSize = currentConf.compSize ?? 25;
  const nameColor = currentConf.nameColor ?? (selectedRank === 1 ? '#cc0000' : '#000000');
  const compColor = currentConf.compColor ?? (selectedRank === 1 ? '#cc0000' : '#000000');
  const nameFont = currentConf.nameFont || '"Montserrat", sans-serif';
  const compFont = currentConf.compFont || '"Montserrat", sans-serif';
  const nameAlign: 'left' | 'center' = currentConf.nameAlign || 'left';
  const compAlign: 'left' | 'center' = currentConf.compAlign || 'left';

  // Preview Logic
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgRef = useRef<HTMLImageElement | null>(null);
  const [dragging, setDragging] = useState<'name' | 'comp' | null>(null);
  const lastMousePos = useRef<{x: number, y: number} | null>(null);
  
  useEffect(() => {
    const img = new Image();
    const url = selectedRank === 1 
      ? certTheme1Url || '/certificate_1.jpg'
      : selectedRank === 2 
        ? certTheme2Url || '/certificate_2.jpg'
        : certTheme3Url || '/certificate_2.jpg';
        
    img.src = url;
    img.onload = () => {
      imgRef.current = img;
      renderPreview();
    };
  }, [selectedRank, eventSettings, certTheme1Url, certTheme2Url, certTheme3Url]);

  const renderPreview = () => {
    if (!imgRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const img = imgRef.current;
    
    // Maintain aspect ratio but fit in container (e.g. 800px wide)
    const scale = 800 / img.width;
    canvas.width = 800;
    canvas.height = img.height * scale;
    
    ctx.scale(scale, scale);
    ctx.drawImage(img, 0, 0, img.width, img.height);
    
    const centerX = img.width / 2;
    
    // Name
    ctx.textAlign = nameAlign;
    ctx.textBaseline = 'bottom';
    ctx.fillStyle = nameColor;
    ctx.font = parseFontForCanvas(nameFont, nameSize, 'bold');
    ctx.fillText('PARTICIPANT NAME', centerX + nameX, nameY);

    // Competition
    ctx.textAlign = compAlign;
    ctx.fillStyle = compColor;
    ctx.font = parseFontForCanvas(compFont, compSize, 'bold');
    ctx.fillText('COMPETITION NAME', centerX + compX, compY);
  };
  
  useEffect(() => {
    renderPreview();
  }, [nameX, nameY, compX, compY, nameSize, compSize, nameColor, compColor, nameFont, compFont, nameAlign, compAlign, selectedRank]);

  // Helper to extract canvas / image X, Y coordinates from Mouse, Touch, or Pointer event
  const getCanvasCoords = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas || !imgRef.current) return null;
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

    const canvasX = (clientX - rect.left) * scaleX;
    const canvasY = (clientY - rect.top) * scaleY;
    const scale = 800 / imgRef.current.width;

    return {
      imgX: canvasX / scale,
      imgY: canvasY / scale,
      clientX,
      clientY
    };
  };

  const handleDragStart = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement> | React.PointerEvent<HTMLCanvasElement>) => {
    const coords = getCanvasCoords(e);
    if (!coords || !imgRef.current) return;
    const { imgX, imgY, clientX, clientY } = coords;

    if (e.cancelable) {
      try { e.preventDefault(); } catch (_) {}
    }

    const centerX = imgRef.current.width / 2;
    
    // hit test with touch-friendly generous hit area respecting alignment
    const nameStartX = centerX + nameX;
    const nameHit = nameAlign === 'center'
      ? Math.abs(imgX - nameStartX) < 350 && imgY > nameY - nameSize - 40 && imgY < nameY + 40
      : imgX >= nameStartX - 40 && imgX <= nameStartX + 500 && imgY > nameY - nameSize - 40 && imgY < nameY + 40;

    const compStartX = centerX + compX;
    const compHit = compAlign === 'center'
      ? Math.abs(imgX - compStartX) < 350 && imgY > compY - compSize - 40 && imgY < compY + 40
      : imgX >= compStartX - 40 && imgX <= compStartX + 500 && imgY > compY - compSize - 40 && imgY < compY + 40;
    
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
      if (!lastMousePos.current || !imgRef.current || !canvasRef.current) return;
      
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
      const imgScale = 800 / imgRef.current.width;

      const deltaClientX = clientX - lastMousePos.current.x;
      const deltaClientY = clientY - lastMousePos.current.y;

      const dx = (deltaClientX * scaleX) / imgScale;
      const dy = (deltaClientY * scaleY) / imgScale;

      if (Math.abs(dx) > 0.01 || Math.abs(dy) > 0.01) {
        if (dragging === 'name') {
          handleUpdate(selectedRank, 'nameX', Math.round(nameX + dx));
          handleUpdate(selectedRank, 'nameY', Math.round(nameY + dy));
        } else if (dragging === 'comp') {
          handleUpdate(selectedRank, 'compX', Math.round(compX + dx));
          handleUpdate(selectedRank, 'compY', Math.round(compY + dy));
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
  }, [dragging, nameX, nameY, compX, compY, selectedRank]);

  if (user.role !== UserRole.SUPER_ADMIN && user.role !== UserRole.SECTOR_TEAM) {
    return <div className="p-8 text-center">Access Denied</div>;
  }

  return (
    <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 font-sans min-w-0 w-full overflow-x-hidden">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
        <div>
          <h1 className="text-2xl font-display font-bold text-slate-900">Certificate Studio</h1>
          <p className="text-sm text-slate-500 mt-1">Adjust coordinates, font sizes, colors, and text alignment for printed certificates.</p>
        </div>
        <button 
          onClick={handleSave} 
          disabled={loading}
          className="px-4 py-2 bg-emerald-600 text-white font-bold rounded-lg hover:bg-emerald-700 transition flex items-center gap-2"
        >
          <Save className="w-4 h-4" />
          {loading ? 'Saving...' : 'Save Layouts'}
        </button>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        <div className="lg:col-span-4 space-y-6">
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-4">
            <h3 className="font-bold text-slate-800 text-sm uppercase tracking-wider">Select Rank to Edit</h3>
            <div className="flex gap-2">
              {ranks.map(r => (
                <button
                  key={r}
                  onClick={() => setSelectedRank(r)}
                  className={`flex-1 py-2 font-bold rounded-lg border ${selectedRank === r ? 'bg-emerald-50 border-emerald-500 text-emerald-700' : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'}`}
                >
                  Rank {r}
                </button>
              ))}
            </div>
            
            <div className="mt-4">
              <label className="flex items-center justify-center gap-1.5 px-3 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded-lg text-sm cursor-pointer border border-emerald-200 transition-colors">
                <span>Upload Custom Theme for Rank {selectedRank}</span>
                <input 
                  type="file" 
                  accept="image/*" 
                  className="hidden" 
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      const reader = new FileReader();
                      reader.onload = (ev) => {
                        const result = ev.target?.result as string;
                        if (selectedRank === 1) setCertTheme1Url(result);
                        else if (selectedRank === 2) setCertTheme2Url(result);
                        else setCertTheme3Url(result);
                      };
                      reader.readAsDataURL(file);
                    }
                  }} 
                />
              </label>
            </div>
          </div>
          
          <div className="bg-white p-5 rounded-2xl shadow-sm border border-slate-100 space-y-6">
             <div>
               <h4 className="font-bold text-sm text-slate-700 border-b pb-2 mb-4">Participant Name Layout</h4>
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-bold text-slate-500 mb-1.5 block">Text Alignment</label>
                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={() => handleUpdate(selectedRank, 'nameAlign', 'left')}
                       className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                         nameAlign === 'left'
                           ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                           : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                       }`}
                     >
                       Left
                     </button>
                     <button
                       type="button"
                       onClick={() => handleUpdate(selectedRank, 'nameAlign', 'center')}
                       className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                         nameAlign === 'center'
                           ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                           : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                       }`}
                     >
                       Center
                     </button>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 flex justify-between">X Offset (from center) <span>{nameX}</span></label>
                   <input type="range" min="-400" max="400" value={nameX} onChange={e => handleUpdate(selectedRank, 'nameX', Number(e.target.value))} className="w-full accent-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 flex justify-between">Y Position <span>{nameY}</span></label>
                   <input type="range" min="100" max="1000" value={nameY} onChange={e => handleUpdate(selectedRank, 'nameY', Number(e.target.value))} className="w-full accent-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 flex justify-between">Font Size <span>{nameSize}</span></label>
                   <input type="range" min="12" max="100" value={nameSize} onChange={e => handleUpdate(selectedRank, 'nameSize', Number(e.target.value))} className="w-full accent-emerald-500" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Font Family</label>
                    <select
                      value={nameFont}
                      onChange={e => handleUpdate(selectedRank, 'nameFont', e.target.value)}
                      className="w-full text-xs p-1.5 border rounded-lg bg-white font-semibold"
                    >
                      {UNIVERSAL_FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-500">Color</label>
                    <input type="color" value={nameColor} onChange={e => handleUpdate(selectedRank, 'nameColor', e.target.value)} className="w-full h-8 rounded border" />
                  </div>
               </div>
             </div>
             
             <div>
               <h4 className="font-bold text-sm text-slate-700 border-b pb-2 mb-4">Competition Name Layout</h4>
               <div className="space-y-3">
                 <div>
                   <label className="text-xs font-bold text-slate-500 mb-1.5 block">Text Alignment</label>
                   <div className="flex gap-2">
                     <button
                       type="button"
                       onClick={() => handleUpdate(selectedRank, 'compAlign', 'left')}
                       className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                         compAlign === 'left'
                           ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                           : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                       }`}
                     >
                       Left
                     </button>
                     <button
                       type="button"
                       onClick={() => handleUpdate(selectedRank, 'compAlign', 'center')}
                       className={`flex-1 py-1.5 px-3 rounded-lg text-xs font-bold border transition-all ${
                         compAlign === 'center'
                           ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                           : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                       }`}
                     >
                       Center
                     </button>
                   </div>
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 flex justify-between">X Offset (from center) <span>{compX}</span></label>
                   <input type="range" min="-400" max="400" value={compX} onChange={e => handleUpdate(selectedRank, 'compX', Number(e.target.value))} className="w-full accent-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 flex justify-between">Y Position <span>{compY}</span></label>
                   <input type="range" min="100" max="1000" value={compY} onChange={e => handleUpdate(selectedRank, 'compY', Number(e.target.value))} className="w-full accent-emerald-500" />
                 </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500 flex justify-between">Font Size <span>{compSize}</span></label>
                   <input type="range" min="12" max="100" value={compSize} onChange={e => handleUpdate(selectedRank, 'compSize', Number(e.target.value))} className="w-full accent-emerald-500" />
                 </div>
                 <div>
                    <label className="text-xs font-bold text-slate-500 mb-1 block">Font Family</label>
                    <select
                      value={compFont}
                      onChange={e => handleUpdate(selectedRank, 'compFont', e.target.value)}
                      className="w-full text-xs p-1.5 border rounded-lg bg-white font-semibold"
                    >
                      {UNIVERSAL_FONT_OPTIONS.map(f => <option key={f.value} value={f.value}>{f.label}</option>)}
                    </select>
                  </div>
                 <div>
                   <label className="text-xs font-bold text-slate-500">Color</label>
                   <input type="color" value={compColor} onChange={e => handleUpdate(selectedRank, 'compColor', e.target.value)} className="w-full h-8 rounded border" />
                 </div>
               </div>
             </div>
             
          </div>
        </div>
        
        <div className="lg:col-span-8 bg-slate-100 p-6 rounded-2xl flex flex-col items-center justify-center border border-slate-200 overflow-hidden relative">
          <div className="mb-2 text-[10px] text-slate-500 font-mono flex items-center gap-1.5 bg-white/80 px-3 py-1 rounded-full shadow-xs border border-slate-200">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            Touch & drag elements directly with your finger on canvas preview
          </div>
          <canvas 
            ref={canvasRef} 
            className="shadow-xl max-w-full h-auto bg-white rounded-lg cursor-move touch-none select-none" 
            onPointerDown={handleDragStart}
            onTouchStart={handleDragStart}
            onMouseDown={handleDragStart}
          />
        </div>
      </div>
    </div>
  );
}
