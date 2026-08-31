import React, { useState, useEffect } from 'react';
import { Settings, Save, Globe, Video, Image as ImageIcon, Loader2, GripVertical, CheckCircle2, Palette, RotateCcw } from 'lucide-react';
import { User, DragBlock, CMSSettings, HeroMedia } from '../types';
import { QRCodeSVG } from 'qrcode.react';
import { Logo } from './Logo';

interface CMSWebsiteStudioProps {
  user: User;
}

export default function CMSWebsiteStudio({ user }: CMSWebsiteStudioProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [dragBlocks, setDragBlocks] = useState<DragBlock[]>([]);
  const [heroMedia, setHeroMedia] = useState<HeroMedia[]>([]);
  const [settings, setSettings] = useState<CMSSettings>({
    aboutTitle: '', aboutSubtitle: '', aboutDescription: '', aboutImage: '', footerText: '',
    themeTitle: '', themeDescription: '',
    heroTitle: '', heroSubtitle: '', heroDate: '', heroLocation: '',
    headerLogoTitle: 'RENDEZVOUS',
    headerLogoSubtitle: 'Silver Edition',
    heroLogoTitle: 'RENDEZVOUS',
    heroLogoSubtitle: 'Silver Edition',
    heroLogoBadge: 'KULLIYATHU IMAM RABBANI',
  });

  const [stage1LiveLink, setStage1LiveLink] = useState('');
  const [stage2LiveLink, setStage2LiveLink] = useState('');
  const [photoHubDriveLink, setPhotoHubDriveLink] = useState('');

  const DEFAULT_COLOR_THEME: Record<string, string> = {
    primaryAccent: '#FF2B2B',
    bodyBg: '#0D0D0D',
    cardBg: '#161619',
    cardElevatedBg: '#1A1A1E',
    borderSubtle: '#2A2A32',
    textPrimary: '#FFFFFF',
    textSecondary: '#E4E4E7',
    textMuted: '#A1A1AA',
    goldAccent: '#F59E0B',
    successAccent: '#10B981',
  };

  const COLOR_ITEMS = [
    { key: 'primaryAccent', label: 'Primary Brand Red Accent', desc: 'Main CTAs, buttons, active highlights, live badges, hover borders', default: '#FF2B2B' },
    { key: 'bodyBg', label: 'Page Body & Modal Background', desc: 'Main background of public website & participant portal', default: '#0D0D0D' },
    { key: 'cardBg', label: 'Card & Section Container Background', desc: 'Winner posters, video cards, result item containers, gallery frames', default: '#161619' },
    { key: 'cardElevatedBg', label: 'Elevated Card & Header Background', desc: 'Table headers, inner card sections, video player header', default: '#1A1A1E' },
    { key: 'borderSubtle', label: 'Subtle Border & Divider Lines', desc: 'Card borders, input fields, modal boundaries, section dividers', default: '#2A2A32' },
    { key: 'textPrimary', label: 'Primary Heading & Title Text', desc: 'Participant name, main headings, modal titles, rank numbers', default: '#FFFFFF' },
    { key: 'textSecondary', label: 'Secondary Sub-header Text', desc: 'Subheadings, card titles, chest number badges', default: '#E4E4E7' },
    { key: 'textMuted', label: 'Muted Text & Timestamps', desc: 'Program categories, unit names, timestamps, durations', default: '#A1A1AA' },
    { key: 'goldAccent', label: 'Gold Rank #1 & Distinction Badge', desc: 'Rank #1 Gold medals, A+ grade badges, logged-in status badge', default: '#F59E0B' },
    { key: 'successAccent', label: 'Success & Verification Green', desc: 'Verified status badges, play buttons, green room indicators', default: '#10B981' },
  ];

  const [colorTheme, setColorTheme] = useState<Record<string, string>>(DEFAULT_COLOR_THEME);
  const [colorSaveSuccess, setColorSaveSuccess] = useState(false);

  const uploadImageFileWithFallback = async (file: File, endpoint: string, onSuccess: (url: string) => void) => {
    try {
      const formData = new FormData();
      formData.append('image', file);
      const token = localStorage.getItem('token');
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
        body: formData
      });
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          onSuccess(data.url);
          return;
        }
      }
    } catch (err) {
      console.warn(`Server upload to ${endpoint} failed, converting locally:`, err);
    }

    // Instant client-side Base64 fallback if server returns 403, 500, or network error
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') {
        onSuccess(reader.result);
      }
    };
    reader.readAsDataURL(file);
  };

  useEffect(() => {
    fetchCMSData();
    // Also fetch event settings for livestream/drive urls
    fetchEventSettings();
  }, []);

  const fetchCMSData = async () => {
    try {
      const response = await fetch('/api/cms', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        const defaultBlocks: DragBlock[] = [
          { id: '1', title: 'Hero Section', type: 'hero', enabled: true, order: 1 },
          { id: '2', title: 'About & Concept', type: 'about', enabled: true, order: 2 },
          { id: '3', title: 'Live Team Standings', type: 'results', enabled: true, order: 3 },
          { id: '4', title: 'Announced Results & Placements', type: 'announcements', enabled: true, order: 4 },
          { id: '5', title: 'Photo Hub (Drive & QR)', type: 'smile', enabled: true, order: 5 },
          { id: '6', title: 'Media Gallery (Photo Uploads)', type: 'gallery', enabled: true, order: 6 },
          { id: '7', title: 'Live Broadcast Streams', type: 'live_stages', enabled: true, order: 7 },
          { id: '8', title: 'Video Highlights & Stage Clips', type: 'highlights', enabled: true, order: 8 }
        ];
        setDragBlocks(data.dragBlocks && data.dragBlocks.length > 0 ? data.dragBlocks : defaultBlocks);
        setHeroMedia(data.heroMedia || []);
        const mergedSettings = data.cmsSettings || {};
        const DEFAULT_CMS_SETTINGS: any = {
          headerLogoTitle: 'RENDEZVOUS',
          headerLogoSubtitle: 'Silver Edition',
          heroLogoTitle: 'RENDEZVOUS',
          heroLogoSubtitle: 'Silver Edition',
          heroLogoBadge: 'KULLIYATHU IMAM RABBANI',
          heroHideLogo: false,
          heroTitle: 'RENDEZVOUS <span class="text-[#FF2B2B]">SILVER EDITION</span>',
          heroSubtitle: 'Imam Rabbani LIFE Festival',
          heroInstitutionLeft: 'Kulliyathu Imam Rabbani',
          heroInstitutionRight: 'Off-Campus of Markaz Garden, Poonoor',
          heroDate: 'September 23 – 24, 2025',
          heroLocation: 'Main Campus Grounds, Poonoor, Kozhikode',
          aboutBadge: 'Festival Vision',
          aboutMainHeading: 'ABOUT THE <span class="text-[#FF2B2B]">FESTIVAL</span>',
          aboutTitle: 'Kulliyathu Imam Rabbani',
          aboutSubtitle: 'Off-Campus of Markaz Garden, Poonoor',
          aboutDescription: 'Kulliyathu Imam Rabbani stands as a premier center of higher Islamic learning and academic excellence, functioning as a key off-campus institute under the revered banner of Markaz Garden, Poonoor.\n\nThe Imam Rabbani LIFE Festival (Rendezvous Silver Edition) is an annual flagship celebration of intellectual, creative, and moral excellence. It brings together over 1200 students across 40+ disciplines.',
          aboutImageBadge: 'INAUGURATION SESSION',
          aboutImageTitle: 'KULLIYATHU IMAM RABBANI',
          aboutImageSubtitle: 'Distinguished Scholars & Dignitaries at Grand Assembly',
          aboutImageLocation: 'Main Stage Auditorium • Markaz Garden Campus',
          aboutImageFooter: 'Markaz Garden Off-Campus',
          themeTitle: 'Transcending the Illusions',
          themeDescription: 'In a world crowded with digital superficiality and sensory illusions, \'Transcending the Illusions\' calls upon the youth to pierce through modern worldly deceptions through classical wisdom, spiritual clarity, and moral fortitude.',
          themeButtonText: 'READ PHILOSOPHICAL CONCEPT',
          conceptModalBadge: 'Theme Concept & Philosophy',
          conceptModalTitle: 'TRANSCENDING THE ILLUSIONS',
          conceptModalSubtitle: 'Kulliyathu Imam Rabbani',
          conceptModalFooter: 'Markaz Garden Off-Campus, Poonoor',
          conceptModalDescription: 'In an era dominated by hyper-digital sensory overload, the human spirit is increasingly trapped.\n\nThe Silver Edition celebrates a milestone legacy of nurturing scholars, leaders, and artists who embody moral integrity.',
          footerLogoTitle: 'RENDEZVOUS',
          footerLogoSubtitle: 'Silver Edition',
          footerLogoBadge: 'KULLIYATHU IMAM RABBANI',
          footerDescription: 'Rendezvous Silver Edition is the flagship Imam Rabbani LIFE Festival organized by Kulliyathu Imam Rabbani, a premier off-campus institute of Markaz Garden, Poonoor.',
          footerLocation: 'Main Campus Grounds, Poonoor, Kozhikode',
          footerEmail: 'contact@imamrabbani.edu.in',
          footerPhone: '+91 98471 23456',
          footerInstagram: 'https://instagram.com/markazgarden',
          footerYoutube: 'https://youtube.com/markazgarden',
          footerFacebook: 'https://facebook.com/markazgarden',
          footerText: '© 2025 Kulliyathu Imam Rabbani (Markaz Garden Off-Campus). All rights reserved.',
          copyrightText: '© 2025 Kulliyathu Imam Rabbani (Markaz Garden Off-Campus). All rights reserved.',
          heroDesktopImages: ['/hero1.jpg', '/hero2.jpg'],
          heroDesktopLoopEnabled: true,
          heroDesktopLoopInterval: 3,
          heroMobileLoopEnabled: true,
          heroMobileLoopInterval: 3
        };

        const finalSettings: any = { ...DEFAULT_CMS_SETTINGS };
        Object.keys(DEFAULT_CMS_SETTINGS).forEach((key) => {
          if (mergedSettings[key] !== undefined && mergedSettings[key] !== '' && mergedSettings[key] !== null) {
            finalSettings[key] = mergedSettings[key];
          }
        });
        setSettings(finalSettings);
        if (mergedSettings.colorTheme) {
          setColorTheme({ ...DEFAULT_COLOR_THEME, ...mergedSettings.colorTheme });
        }
      }
    } catch (err) {
      console.error('Failed to fetch CMS', err);
    } finally {
      setLoading(false);
    }
  };

  const fetchEventSettings = async () => {
    try {
      const response = await fetch('/api/settings', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setStage1LiveLink(data.stage1LiveLink || '');
        setStage2LiveLink(data.stage2LiveLink || '');
        setPhotoHubDriveLink(data.photoHubDriveLink || '');
      }
    } catch (err) {
      console.error(err);
    }
  };

  const handleSaveCMS = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updatedSettings = {
        ...settings,
        colorTheme
      };

      const response = await fetch('/api/cms', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ dragBlocks, heroMedia, cmsSettings: updatedSettings })
      });
      
      // Also save event settings for live/drive url
      await fetch('/api/settings', {
        method: 'PUT',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          stage1LiveLink,
          stage2LiveLink,
          photoHubDriveLink
        })
      });

      if (response.ok) {
        alert('CMS Settings saved successfully');
      }
    } catch (err) {
      console.error('Failed to save CMS', err);
      alert('Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  const moveBlock = (index: number, direction: 'up' | 'down') => {
    if ((direction === 'up' && index === 0) || (direction === 'down' && index === dragBlocks.length - 1)) return;
    
    const newBlocks = [...dragBlocks];
    const swapIndex = direction === 'up' ? index - 1 : index + 1;
    
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[swapIndex];
    newBlocks[swapIndex] = temp;
    
    // Update order property
    newBlocks.forEach((b, i) => b.order = i + 1);
    setDragBlocks(newBlocks);
  };

  const toggleBlock = (index: number) => {
    const newBlocks = [...dragBlocks];
    newBlocks[index].enabled = !newBlocks[index].enabled;
    setDragBlocks(newBlocks);
  };

  if (loading) return <div className="p-6 text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin"/> Loading CMS Data...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans pb-32 min-w-0 w-full overflow-x-hidden">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Globe className="text-emerald-500 w-6 h-6" />
            Website Editor (CMS)
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage public website content, live streams, and layout.</p>
        </div>
        <button
          onClick={handleSaveCMS}
          disabled={saving}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white px-5 py-2.5 rounded-xl transition-all shadow-sm shadow-emerald-500/20 font-medium"
        >
          {saving ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
          Publish Changes
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column - Content Settings */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Media Links */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Video className="w-5 h-5 text-emerald-500" />
              <h3 className="font-bold text-slate-900">Media & Live Links</h3>
            </div>
            <div className="p-5 space-y-5">
              
              <div className="space-y-4">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Stage 1 Live Stream YouTube URL</label>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={stage1LiveLink}
                        onChange={(e) => setStage1LiveLink(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      />
                      <div className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center whitespace-nowrap ${stage1LiveLink ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        {stage1LiveLink ? 'ONLINE' : 'OFFLINE'}
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Stage 2 Live Stream YouTube URL</label>
                    <div className="flex gap-3">
                      <input
                        type="url"
                        value={stage2LiveLink}
                        onChange={(e) => setStage2LiveLink(e.target.value)}
                        placeholder="https://www.youtube.com/watch?v=..."
                        className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm"
                      />
                      <div className={`px-3 py-2 rounded-xl text-xs font-bold border flex items-center justify-center whitespace-nowrap ${stage2LiveLink ? 'bg-emerald-50 border-emerald-200 text-emerald-700' : 'bg-slate-100 border-slate-200 text-slate-500'}`}>
                        {stage2LiveLink ? 'ONLINE' : 'OFFLINE'}
                      </div>
                    </div>
                  </div>
                  <p className="text-xs text-slate-500 mt-1">If empty, the respective Live Stream section will show as offline.</p>
                </div>

              <div className="pt-3 border-t border-slate-100">
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-2">Photo Hub Drive Link</label>
                <div className="flex flex-col md:flex-row gap-5 items-start">
                  <div className="flex-grow w-full">
                    <input
                      type="url"
                      value={photoHubDriveLink}
                      onChange={(e) => setPhotoHubDriveLink(e.target.value)}
                      placeholder="https://drive.google.com/..."
                      className="w-full px-3 py-2 border border-slate-300 rounded-xl text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm mb-2"
                    />
                    <p className="text-xs text-slate-500">The QR Code will automatically update based on this link. Visitors can scan it to view live drive folders.</p>
                  </div>
                  {photoHubDriveLink && (
                    <div className="shrink-0 bg-white p-2 border border-slate-200 rounded-xl shadow-sm">
                      <QRCodeSVG value={photoHubDriveLink} size={100} level="H" />
                    </div>
                  )}
                </div>
              </div>

            </div>
          </div>

          {/* Hero Media Backgrounds */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-5 h-5 text-emerald-500" />
                <h3 className="font-bold text-slate-900">Hero Background Images</h3>
              </div>
            </div>
            <div className="p-5 space-y-8">
              {/* Desktop Backgrounds */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">Desktop Screens (16:9)</h4>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={settings.heroDesktopLoopEnabled !== false} onChange={(e) => setSettings({...settings, heroDesktopLoopEnabled: e.target.checked})} className="rounded text-emerald-500 focus:ring-emerald-500" />
                      <span className="text-xs font-medium text-slate-600">Enable Looping</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-600">Interval (sec):</label>
                      <input type="number" min="1" max="20" value={settings.heroDesktopLoopInterval || 3} onChange={(e) => setSettings({...settings, heroDesktopLoopInterval: Number(e.target.value)})} className="w-16 px-2 py-1 border border-slate-300 rounded text-xs" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-4">Upload up to 5 background images. If disabled or empty, a simple black background will be shown.</p>
                
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {(settings.heroDesktopImages || []).map((url, idx) => (
                    <div key={idx} className="relative shrink-0 w-40 h-24 rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={url} alt="Hero bg" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setSettings({...settings, heroDesktopImages: settings.heroDesktopImages!.filter((_, i) => i !== idx)})}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  
                  {(settings.heroDesktopImages || []).length < 5 && (
                    <label className="shrink-0 w-40 h-24 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-300 hover:bg-emerald-50 transition-colors cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        if (e.target.files?.[0]) {
                          const formData = new FormData();
                          formData.append('image', e.target.files[0]);
                          try {
                            const res = await fetch('/api/hero/upload', {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                              body: formData
                            });
                            if (res.ok) {
                              const { url } = await res.json();
                              setSettings({...settings, heroDesktopImages: [...(settings.heroDesktopImages || []), url]});
                            } else {
                              alert('Upload failed');
                            }
                          } catch (err) {
                            alert('Network error');
                          }
                        }
                      }} />
                      <ImageIcon className="w-6 h-6 mb-1" />
                      <span className="text-[10px] font-medium uppercase tracking-wider">Add Desktop Image</span>
                    </label>
                  )}
                </div>
              </div>

              {/* Mobile Backgrounds */}
              <div className="pt-6 border-t border-slate-100">
                <div className="flex items-center justify-between mb-2">
                  <h4 className="text-sm font-semibold text-slate-700">Mobile Screens (9:16)</h4>
                  <div className="flex items-center gap-4">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input type="checkbox" checked={settings.heroMobileLoopEnabled === true} onChange={(e) => setSettings({...settings, heroMobileLoopEnabled: e.target.checked})} className="rounded text-emerald-500 focus:ring-emerald-500" />
                      <span className="text-xs font-medium text-slate-600">Enable Looping</span>
                    </label>
                    <div className="flex items-center gap-2">
                      <label className="text-xs font-medium text-slate-600">Interval (sec):</label>
                      <input type="number" min="1" max="20" value={settings.heroMobileLoopInterval || 3} onChange={(e) => setSettings({...settings, heroMobileLoopInterval: Number(e.target.value)})} className="w-16 px-2 py-1 border border-slate-300 rounded text-xs" />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-slate-500 mb-4">Upload up to 3 vertical background images for mobile. If disabled or empty, a simple black background will be shown.</p>
                
                <div className="flex gap-4 overflow-x-auto pb-2">
                  {(settings.heroMobileImages || []).map((url, idx) => (
                    <div key={idx} className="relative shrink-0 w-20 h-32 rounded-lg overflow-hidden border border-slate-200 group">
                      <img src={url} alt="Hero bg mobile" className="w-full h-full object-cover" />
                      <button 
                        type="button"
                        onClick={() => setSettings({...settings, heroMobileImages: settings.heroMobileImages!.filter((_, i) => i !== idx)})}
                        className="absolute top-1 right-1 bg-red-500 text-white rounded-md p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                      </button>
                    </div>
                  ))}
                  
                  {(settings.heroMobileImages || []).length < 3 && (
                    <label className="shrink-0 w-20 h-32 rounded-lg border-2 border-dashed border-slate-300 flex flex-col items-center justify-center text-slate-400 hover:text-emerald-500 hover:border-emerald-300 hover:bg-emerald-50 transition-colors cursor-pointer">
                      <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                        if (e.target.files?.[0]) {
                          const formData = new FormData();
                          formData.append('image', e.target.files[0]);
                          try {
                            const res = await fetch('/api/hero/upload', {
                              method: 'POST',
                              headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` },
                              body: formData
                            });
                            if (res.ok) {
                              const { url } = await res.json();
                              setSettings({...settings, heroMobileImages: [...(settings.heroMobileImages || []), url]});
                            } else {
                              alert('Upload failed');
                            }
                          } catch (err) {
                            alert('Network error');
                          }
                        }
                      }} />
                      <ImageIcon className="w-5 h-5 mb-1" />
                      <span className="text-[9px] font-medium uppercase tracking-wider text-center px-1">Add Mobile Image</span>
                    </label>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Text Content */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Text Content & Copy</h3>
            </div>
            <div className="p-5 space-y-6">
              
              {/* Header / Navbar Branding */}
              <div className="space-y-4 pb-6 border-b border-slate-100">
                <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Header / Navbar Branding</h4>
                
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Header Custom Logo Icon (Optional)</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-md overflow-hidden border border-slate-200 relative group flex items-center justify-center p-2">
                      <div className="scale-75 origin-center text-white">
                        <Logo 
                          size="md" 
                          variant="icon" 
                          customIconUrl={settings.headerLogo || settings.heroLogo}
                        />
                      </div>
                      {settings.headerLogo && (
                        <button type="button" onClick={() => setSettings({...settings, headerLogo: ''})} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-bold z-20">REMOVE</button>
                      )}
                    </div>
                    <label className="shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md text-sm font-medium text-slate-700 cursor-pointer transition-colors inline-flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      <span>{settings.headerLogo ? 'Change Header Logo' : 'Upload Header Logo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) {
                          uploadImageFileWithFallback(e.target.files[0], '/api/hero/upload', (url) => setSettings(prev => ({ ...prev, headerLogo: url })));
                        }
                      }} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Header Logo Title</label>
                    <input type="text" value={settings.headerLogoTitle !== undefined ? settings.headerLogoTitle : 'RENDEZVOUS'} onChange={(e) => setSettings({...settings, headerLogoTitle: e.target.value})} placeholder="RENDEZVOUS" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Header Logo Subtitle</label>
                    <input type="text" value={settings.headerLogoSubtitle !== undefined ? settings.headerLogoSubtitle : 'Silver Edition'} onChange={(e) => setSettings({...settings, headerLogoSubtitle: e.target.value})} placeholder="Silver Edition" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-800" />
                  </div>
                </div>
              </div>

              {/* Hero */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Hero Section</h4>
                  <label className="flex items-center gap-2 cursor-pointer bg-slate-50 px-3 py-1.5 rounded-md border border-slate-200 hover:bg-slate-100 transition-colors">
                    <input 
                      type="checkbox" 
                      checked={settings.heroHideLogo || false} 
                      onChange={(e) => setSettings({...settings, heroHideLogo: e.target.checked})}
                      className="w-4 h-4 text-emerald-600 rounded border-slate-300 focus:ring-emerald-500"
                    />
                    <span className="text-xs font-medium text-slate-700">Hide Hero Logo</span>
                  </label>
                </div>
                
                {/* Hero Logo Upload */}
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Hero Custom Logo (Optional)</label>
                  <div className="flex items-center gap-4">
                      <div className="w-20 h-20 bg-slate-50 rounded-md overflow-hidden border border-slate-200 relative group flex items-center justify-center p-2">
                        <div className="scale-75 origin-center text-white">
                          <Logo 
                            size="md" 
                            variant="icon" 
                            customIconUrl={settings.heroLogo}
                          />
                        </div>
                        {settings.heroLogo && (
                          <button type="button" onClick={() => setSettings({...settings, heroLogo: ''})} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-bold z-20">REMOVE CUSTOM ICON</button>
                        )}
                      </div>
                    <label className="shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md text-sm font-medium text-slate-700 cursor-pointer transition-colors inline-flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      <span>{settings.heroLogo ? 'Change Logo' : 'Upload Custom Logo'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) {
                          uploadImageFileWithFallback(e.target.files[0], '/api/hero/upload', (url) => setSettings(prev => ({ ...prev, heroLogo: url })));
                        }
                      }} />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Logo Title</label>
                    <input type="text" value={settings.heroLogoTitle !== undefined ? settings.heroLogoTitle : 'RENDEZVOUS'} onChange={(e) => setSettings({...settings, heroLogoTitle: e.target.value})} placeholder="RENDEZVOUS" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Logo Subtitle</label>
                    <input type="text" value={settings.heroLogoSubtitle !== undefined ? settings.heroLogoSubtitle : 'Silver Edition'} onChange={(e) => setSettings({...settings, heroLogoSubtitle: e.target.value})} placeholder="Silver Edition" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Logo Badge</label>
                    <input type="text" value={settings.heroLogoBadge !== undefined ? settings.heroLogoBadge : 'KULLIYATHU IMAM RABBANI'} onChange={(e) => setSettings({...settings, heroLogoBadge: e.target.value})} placeholder="KULLIYATHU IMAM RABBANI" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm font-medium text-slate-800" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Main Title (HTML Allowed)</label>
                    <input type="text" value={settings.heroTitle} onChange={(e) => setSettings({...settings, heroTitle: e.target.value})} placeholder='RENDEZVOUS <span class="text-[#FF2B2B]">SILVER EDITION</span>' className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Subtitle</label>
                    <input type="text" value={settings.heroSubtitle} onChange={(e) => setSettings({...settings, heroSubtitle: e.target.value})} placeholder="Imam Rabbani LIFE Festival" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Institution Text (Left)</label>
                    <input type="text" value={settings.heroInstitutionLeft} onChange={(e) => setSettings({...settings, heroInstitutionLeft: e.target.value})} placeholder="Kulliyathu Imam Rabbani" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Institution Text (Right)</label>
                    <input type="text" value={settings.heroInstitutionRight} onChange={(e) => setSettings({...settings, heroInstitutionRight: e.target.value})} placeholder="Off-Campus of Markaz Garden, Poonoor" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Date string</label>
                    <input type="text" value={settings.heroDate} onChange={(e) => setSettings({...settings, heroDate: e.target.value})} placeholder="September 23 – 24, 2025" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Location string</label>
                    <input type="text" value={settings.heroLocation} onChange={(e) => setSettings({...settings, heroLocation: e.target.value})} placeholder="Main Campus Grounds, Poonoor, Kozhikode" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </div>

              {/* About */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">About Section</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Badge Text</label>
                    <input type="text" value={settings.aboutBadge} onChange={(e) => setSettings({...settings, aboutBadge: e.target.value})} placeholder="FESTIVAL VISION" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Main Heading</label>
                    <input type="text" value={settings.aboutMainHeading} onChange={(e) => setSettings({...settings, aboutMainHeading: e.target.value})} placeholder="ABOUT THE FESTIVAL" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Title</label>
                    <input type="text" value={settings.aboutTitle} onChange={(e) => setSettings({...settings, aboutTitle: e.target.value})} placeholder="Kulliyathu Imam Rabbani" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Subtitle</label>
                    <input type="text" value={settings.aboutSubtitle} onChange={(e) => setSettings({...settings, aboutSubtitle: e.target.value})} placeholder="Off-Campus of Markaz Garden, Poonoor" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Description</label>
                  <textarea value={settings.aboutDescription} onChange={(e) => setSettings({...settings, aboutDescription: e.target.value})} placeholder="Kulliyathu Imam Rabbani stands as a premier center..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-24" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">About Image Background</label>
                  <div className="flex items-center gap-4">
                    {settings.aboutImage ? (
                      <div className="w-32 h-20 rounded-md overflow-hidden border border-slate-200 relative group shrink-0">
                        <img src={settings.aboutImage} alt="About bg" className="w-full h-full object-cover" />
                        <button type="button" onClick={() => setSettings({...settings, aboutImage: ''})} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-xs font-bold">REMOVE</button>
                      </div>
                    ) : (
                      <div className="w-32 h-20 rounded-md overflow-hidden border border-slate-200 relative group shrink-0 bg-slate-100">
                        <img src="https://images.unsplash.com/photo-1541829070764-84a7d30dd3f3?auto=format&fit=crop&w=1200&q=80" alt="About bg Default" className="w-full h-full object-cover opacity-80" />
                        <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[9px] text-center py-0.5 font-semibold tracking-wider uppercase">Default</div>
                      </div>
                    )}
                    <label className="shrink-0 px-4 py-2 bg-slate-100 hover:bg-slate-200 border border-slate-300 rounded-md text-sm font-medium text-slate-700 cursor-pointer transition-colors inline-flex items-center gap-2">
                      <ImageIcon className="w-4 h-4" />
                      <span>{settings.aboutImage ? 'Change Image' : 'Upload Image'}</span>
                      <input type="file" accept="image/*" className="hidden" onChange={(e) => {
                        if (e.target.files?.[0]) {
                          uploadImageFileWithFallback(e.target.files[0], '/api/about/upload', (url) => setSettings(prev => ({ ...prev, aboutImage: url })));
                        }
                      }} />
                    </label>
                  </div>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Image Badge</label>
                    <input type="text" value={settings.aboutImageBadge} onChange={(e) => setSettings({...settings, aboutImageBadge: e.target.value})} placeholder="INAUGURATION SESSION" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Image Title</label>
                    <input type="text" value={settings.aboutImageTitle} onChange={(e) => setSettings({...settings, aboutImageTitle: e.target.value})} placeholder="KULLIYATHU IMAM RABBANI" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-xs font-medium text-slate-600 mb-1">Image Subtitle</label>
                    <input type="text" value={settings.aboutImageSubtitle} onChange={(e) => setSettings({...settings, aboutImageSubtitle: e.target.value})} placeholder="Distinguished Scholars & Dignitaries at Grand Assembly" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Image Location</label>
                    <input type="text" value={settings.aboutImageLocation} onChange={(e) => setSettings({...settings, aboutImageLocation: e.target.value})} placeholder="Main Stage Auditorium • Markaz Garden Campus" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Image Footer</label>
                    <input type="text" value={settings.aboutImageFooter} onChange={(e) => setSettings({...settings, aboutImageFooter: e.target.value})} placeholder="Markaz Garden Off-Campus" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
              </div>

              {/* Theme */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Theme Card</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Theme Title</label>
                    <input type="text" value={settings.themeTitle} onChange={(e) => setSettings({...settings, themeTitle: e.target.value})} placeholder="Transcending the Illusions" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Button Text</label>
                    <input type="text" value={settings.themeButtonText} onChange={(e) => setSettings({...settings, themeButtonText: e.target.value})} placeholder="READ PHILOSOPHICAL CONCEPT" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Theme Quote</label>
                  <textarea value={settings.themeDescription} onChange={(e) => setSettings({...settings, themeDescription: e.target.value})} placeholder="Education is not merely..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-20" />
                </div>
              </div>

              {/* Concept Modal */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Concept Modal (Pop-up)</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Modal Badge</label>
                    <input type="text" value={settings.conceptModalBadge} onChange={(e) => setSettings({...settings, conceptModalBadge: e.target.value})} placeholder="Theme Concept & Philosophy" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Modal Footer</label>
                    <input type="text" value={settings.conceptModalFooter} onChange={(e) => setSettings({...settings, conceptModalFooter: e.target.value})} placeholder="Markaz Garden Off-Campus, Poonoor" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Modal Title</label>
                    <input type="text" value={settings.conceptModalTitle} onChange={(e) => setSettings({...settings, conceptModalTitle: e.target.value})} placeholder="TRANSCENDING THE ILLUSIONS" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Modal Subtitle</label>
                    <input type="text" value={settings.conceptModalSubtitle} onChange={(e) => setSettings({...settings, conceptModalSubtitle: e.target.value})} placeholder="Kulliyathu Imam Rabbani" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Modal Description (Paragraphs)</label>
                  <p className="text-[10px] text-slate-400 mb-1">Separate paragraphs with a blank line.</p>
                  <textarea value={settings.conceptModalDescription} onChange={(e) => setSettings({...settings, conceptModalDescription: e.target.value})} placeholder="In an era dominated by...&#10;&#10;The Silver Edition celebrates..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm h-32" />
                </div>
              </div>

              {/* Footer Section */}
              <div className="space-y-4 pt-4 border-t border-slate-100">
                <h4 className="text-sm font-semibold text-emerald-600 uppercase tracking-wider">Footer Section</h4>
                
                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Footer Logo</label>
                  <div className="flex items-center gap-4">
                    <div className="w-20 h-20 bg-slate-50 rounded-md overflow-hidden border border-slate-200 relative group flex items-center justify-center p-2">
                        <div className="scale-75 origin-center text-white">
                          <Logo 
                            size="md" 
                            variant="icon" 
                            customIconUrl={settings.footerLogo}
                          />
                        </div>
                        {settings.footerLogo && (
                          <button type="button" onClick={() => setSettings({...settings, footerLogo: ''})} className="absolute inset-0 bg-red-500/80 text-white opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity text-[10px] font-bold z-20">REMOVE CUSTOM ICON</button>
                        )}
                    </div>
                    <label className="cursor-pointer border-2 border-dashed border-slate-300 hover:border-emerald-500 hover:bg-emerald-50 rounded-lg px-4 py-3 text-sm font-medium text-slate-600 transition-colors flex items-center gap-2">
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" /></svg>
                      {settings.footerLogo ? 'Change Logo' : 'Upload Logo'}
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={(e) => {
                          if (e.target.files?.[0]) {
                            uploadImageFileWithFallback(e.target.files[0], '/api/footer/upload', (url) => setSettings(prev => ({ ...prev, footerLogo: url })));
                          }
                        }}
                      />
                    </label>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Logo Title</label>
                    <input type="text" value={settings.footerLogoTitle} onChange={(e) => setSettings({...settings, footerLogoTitle: e.target.value})} placeholder="RENDEZVOUS" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Logo Subtitle</label>
                    <input type="text" value={settings.footerLogoSubtitle} onChange={(e) => setSettings({...settings, footerLogoSubtitle: e.target.value})} placeholder="Silver Edition" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Logo Badge</label>
                    <input type="text" value={settings.footerLogoBadge} onChange={(e) => setSettings({...settings, footerLogoBadge: e.target.value})} placeholder="KULLIYATHU IMAM RABBANI" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Footer Description</label>
                  <textarea rows={3} value={settings.footerDescription} onChange={(e) => setSettings({...settings, footerDescription: e.target.value})} placeholder="Rendezvous Silver Edition is the flagship Imam Rabbani LIFE Festival..." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Location</label>
                    <input type="text" value={settings.footerLocation} onChange={(e) => setSettings({...settings, footerLocation: e.target.value})} placeholder="Main Campus Grounds, Poonoor, Kozhikode" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Email</label>
                    <input type="email" value={settings.footerEmail} onChange={(e) => setSettings({...settings, footerEmail: e.target.value})} placeholder="contact@imamrabbani.edu.in" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Phone</label>
                    <input type="text" value={settings.footerPhone} onChange={(e) => setSettings({...settings, footerPhone: e.target.value})} placeholder="+91 98471 23456" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Instagram Link</label>
                    <input type="url" value={settings.footerInstagram} onChange={(e) => setSettings({...settings, footerInstagram: e.target.value})} placeholder="https://instagram.com/markazgarden" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">YouTube Link</label>
                    <input type="url" value={settings.footerYoutube} onChange={(e) => setSettings({...settings, footerYoutube: e.target.value})} placeholder="https://youtube.com/markazgarden" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-slate-600 mb-1">Facebook Link</label>
                    <input type="url" value={settings.footerFacebook} onChange={(e) => setSettings({...settings, footerFacebook: e.target.value})} placeholder="https://facebook.com/markazgarden" className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium text-slate-600 mb-1">Copyright Text</label>
                  <input type="text" value={settings.footerText} onChange={(e) => setSettings({...settings, footerText: e.target.value})} placeholder="© 2025 Kulliyathu Imam Rabbani (Markaz Garden Off-Campus). All rights reserved." className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm" />
                </div>
              </div>

            </div>
          </div>

          {/* SECTION: Website Theme & Color Palette Customizer */}
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden">
            <div className="p-4 sm:p-5 border-b border-slate-100 bg-gradient-to-r from-slate-50 to-indigo-50/40 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-indigo-600/10 text-indigo-600 rounded-xl">
                  <Palette className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-base">Website Theme & Color Palette Customizer</h3>
                  <p className="text-xs text-slate-500 mt-0.5">Customize every color across the public website and participant portal. Changes apply live.</p>
                </div>
              </div>

              {colorSaveSuccess && (
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs rounded-lg font-medium animate-in fade-in">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> Color theme saved live!
                </div>
              )}
            </div>

            <div className="p-5 space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {COLOR_ITEMS.map((item) => (
                  <div key={item.key} className="p-3.5 bg-slate-50/80 border border-slate-200/70 rounded-xl space-y-2 hover:border-slate-300 transition-colors">
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <span className="text-xs font-bold text-slate-800 block">{item.label}</span>
                        <span className="text-[11px] text-slate-500">{item.desc}</span>
                      </div>
                      <div 
                        className="w-7 h-7 rounded-lg border border-slate-300 shadow-inner shrink-0" 
                        style={{ backgroundColor: colorTheme[item.key] || item.default }} 
                      />
                    </div>
                    <div className="flex items-center gap-2 pt-1">
                      <input 
                        type="color" 
                        value={colorTheme[item.key] || item.default} 
                        onChange={(e) => setColorTheme({ ...colorTheme, [item.key]: e.target.value })}
                        className="w-9 h-8 rounded cursor-pointer border border-slate-300 bg-white p-0.5" 
                      />
                      <input 
                        type="text" 
                        value={colorTheme[item.key] || item.default} 
                        onChange={(e) => setColorTheme({ ...colorTheme, [item.key]: e.target.value })}
                        className="w-full px-3 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-mono text-slate-900 focus:ring-1 focus:ring-indigo-500 outline-none uppercase" 
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Action Buttons: Save & Reset */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Are you sure you want to reset all colors back to default?')) {
                      setColorTheme(DEFAULT_COLOR_THEME);
                    }
                  }}
                  className="w-full sm:w-auto px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-medium text-xs flex items-center justify-center gap-2 transition-colors cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Reset All Colors to Default
                </button>

                <button
                  type="button"
                  onClick={async () => {
                    const updatedSettings = {
                      ...settings,
                      colorTheme
                    };
                    setSettings(updatedSettings);
                    try {
                      const response = await fetch('/api/cms', {
                        method: 'PUT',
                        headers: {
                          'Authorization': `Bearer ${localStorage.getItem('token')}`,
                          'Content-Type': 'application/json'
                        },
                        body: JSON.stringify({ dragBlocks, heroMedia, cmsSettings: updatedSettings })
                      });
                      if (response.ok) {
                        setColorSaveSuccess(true);
                        setTimeout(() => setColorSaveSuccess(false), 3000);
                      }
                    } catch (err) {
                      console.error('Failed to save color theme', err);
                    }
                  }}
                  className="w-full sm:w-auto px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold text-xs flex items-center justify-center gap-2 transition-colors shadow-sm shadow-indigo-500/20 cursor-pointer"
                >
                  <Save className="w-4 h-4" /> Save Color Palette
                </button>
              </div>
            </div>
          </div>

        </div>

        {/* Right Column - Block Ordering */}
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm overflow-hidden sticky top-6">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50">
              <h3 className="font-bold text-slate-900">Website Layout order</h3>
              <p className="text-xs text-slate-500 mt-1">Drag or use arrows to reorder sections on the homepage.</p>
            </div>
            <div className="p-3">
              {dragBlocks.sort((a, b) => a.order - b.order).map((block, index) => (
                <div key={block.id} className={`flex items-center justify-between p-3 mb-2 rounded-xl border ${block.enabled ? 'bg-white border-slate-200 shadow-sm' : 'bg-slate-50 border-slate-100 opacity-60'} transition-all`}>
                  <div className="flex items-center gap-3">
                    <div className="flex flex-col">
                      <button onClick={() => moveBlock(index, 'up')} disabled={index === 0} className="text-slate-400 hover:text-emerald-600 disabled:opacity-30">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" /></svg>
                      </button>
                      <button onClick={() => moveBlock(index, 'down')} disabled={index === dragBlocks.length - 1} className="text-slate-400 hover:text-emerald-600 disabled:opacity-30">
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" /></svg>
                      </button>
                    </div>
                    <div>
                      <h4 className="font-semibold text-slate-900 text-sm">{block.title}</h4>
                      <p className="text-[10px] text-slate-400 font-mono uppercase">{block.type}</p>
                    </div>
                  </div>
                  <label className="relative inline-flex items-center cursor-pointer">
                    <input type="checkbox" className="sr-only peer" checked={block.enabled} onChange={() => toggleBlock(index)} />
                    <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-500"></div>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
