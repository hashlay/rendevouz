import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Video, Plus, X, Play, Loader2, AlertCircle } from 'lucide-react';
import { VideoHighlight, User } from '../types';

interface HighlightsStudioProps {
  user: User;
}

const getMediaUrl = (url: string | undefined): string => {
  if (!url) return '';
  if (url.startsWith('http://') || url.startsWith('https://') || url.startsWith('data:')) {
    return url;
  }
  const baseUrl = (import.meta as any).env?.VITE_API_BASE_URL || '';
  const cleanBase = baseUrl.replace(/\/$/, '');
  const cleanPath = url.startsWith('/') ? url : `/${url}`;
  return `${cleanBase}${cleanPath}`;
};

interface BackgroundTask {
  id: string;
  title: string;
  status: 'uploading' | 'failed';
  error?: string;
}

function getThumbnailUrl(item: any): string | null {
  if (item.thumbnailUrl) return item.thumbnailUrl;
  if (!item.videoUrl) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = item.videoUrl.match(regExp);
  if (match && match[2].length === 11) {
    return `https://img.youtube.com/vi/${match[2]}/hqdefault.jpg`;
  }
  return null;
}

function getEmbedUrl(url: string): { isYouTube: boolean; embedUrl: string } {
  if (!url) return { isYouTube: false, embedUrl: '' };
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  if (match && match[2].length === 11) {
    return { isYouTube: true, embedUrl: `https://www.youtube.com/embed/${match[2]}?autoplay=1` };
  }
  return { isYouTube: false, embedUrl: url };
}

export default function HighlightsStudio({ user }: HighlightsStudioProps) {
  const [highlights, setHighlights] = useState<VideoHighlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [activeVideo, setActiveVideo] = useState<VideoHighlight | null>(null);
  const [realDurations, setRealDurations] = useState<Record<string, string>>({});

  // Form state for Add Highlight modal
  const [title, setTitle] = useState('');
  const [event, setEvent] = useState('');
  const [performer, setPerformer] = useState('');
  const [duration, setDuration] = useState('');
  const [stageName, setStageName] = useState('');
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>(() => {
    try {
      const saved = localStorage.getItem('rendezvous_bg_tasks_highlights');
      const parsed: BackgroundTask[] = saved ? JSON.parse(saved) : [];
      // Only keep failed tasks from previous sessions; clear stale 'uploading' tasks on boot
      return parsed.filter(t => t.status === 'failed');
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rendezvous_bg_tasks_highlights', JSON.stringify(backgroundTasks));
    } catch (e) {}
  }, [backgroundTasks]);

  useEffect(() => {
    fetchHighlights();
  }, []);

  // Auto-extract video file duration when selected in form
  const handleFileSelect = (file: File | null) => {
    setVideoFile(file);
    if (file) {
      const tempVideo = document.createElement('video');
      tempVideo.preload = 'metadata';
      tempVideo.src = URL.createObjectURL(file);
      tempVideo.onloadedmetadata = () => {
        URL.revokeObjectURL(tempVideo.src);
        const sec = Math.floor(tempVideo.duration);
        if (!isNaN(sec) && sec > 0) {
          const mins = Math.floor(sec / 60);
          const remSec = sec % 60;
          const formatted = `${String(mins).padStart(2, '0')}:${String(remSec).padStart(2, '0')}`;
          setDuration(formatted);
        }
      };
    }
  };

  useEffect(() => {
    fetchHighlights();
  }, []);

  const fetchHighlights = async () => {
    try {
      const response = await fetch('/api/highlights', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setHighlights(data);
      }
    } catch (err) {
      console.error('Failed to fetch highlights', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!videoFile) {
      setError('Please select a video file.');
      return;
    }

    const tempId = 'task_' + Date.now();
    const taskTitle = title || videoFile.name;
    
    // Add to background tasks
    setBackgroundTasks(prev => [...prev, { id: tempId, title: taskTitle, status: 'uploading' }]);
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('event', event);
    formData.append('performer', performer);
    formData.append('duration', duration);
    formData.append('stageName', stageName);
    formData.append('video', videoFile);

    // Close modal instantly and clear form
    setIsModalOpen(false);
    resetForm();

    // Perform upload in background
    fetch('/api/highlights/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    })
    .then(async (response) => {
      if (response.ok) {
        await fetchHighlights();
        // Remove task on success
        setBackgroundTasks(prev => prev.filter(t => t.id !== tempId));
      } else {
        const data = await response.json();
        setBackgroundTasks(prev => prev.map(t => t.id === tempId ? { ...t, status: 'failed', error: data.error || 'Upload failed' } : t));
      }
    })
    .catch((err) => {
      console.error(err);
      setBackgroundTasks(prev => prev.map(t => t.id === tempId ? { ...t, status: 'failed', error: 'Network error' } : t));
    });
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this highlight?')) return;
    try {
      const response = await fetch(`/api/highlights/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        fetchHighlights();
      }
    } catch (err) {
      console.error('Failed to delete highlight', err);
    }
  };

  const dismissTask = (id: string) => {
    setBackgroundTasks(prev => prev.filter(t => t.id !== id));
  };

  const resetForm = () => {
    setTitle('');
    setEvent('');
    setPerformer('');
    setDuration('');
    setStageName('');
    setVideoFile(null);
    setError('');
  };

  if (loading) return <div className="p-6 text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin w-5 h-5"/> Loading highlights...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans min-w-0 w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <Video className="text-emerald-500 w-6 h-6" />
            Video Highlights
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage public video clips and performance highlights.</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-500/20 font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Add Highlight
        </button>
      </div>

      {backgroundTasks.length > 0 && (
        <div className="bg-white rounded-2xl border border-slate-200/80 shadow-sm p-4 space-y-3">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin text-emerald-500" /> Background Uploads
          </h3>
          <div className="grid gap-3">
            {backgroundTasks.map(task => (
              <div key={task.id} className="flex items-center justify-between bg-slate-50 border border-slate-100 rounded-xl p-3 text-sm">
                <div className="flex items-center gap-3">
                  {task.status === 'uploading' ? (
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-500" />
                  ) : (
                    <AlertCircle className="w-4 h-4 text-red-500" />
                  )}
                  <span className="font-medium text-slate-700">{task.title}</span>
                  {task.status === 'uploading' && <span className="text-xs text-slate-500">Uploading in background...</span>}
                  {task.status === 'failed' && <span className="text-xs text-red-500 font-medium">Failed: {task.error}</span>}
                </div>
                {task.status === 'failed' && (
                  <button onClick={() => dismissTask(task.id)} className="text-slate-400 hover:text-slate-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {highlights.length === 0 && backgroundTasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 border-dashed">
          <Video className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-900 font-medium">No Highlights Uploaded</h3>
          <p className="text-slate-500 text-sm mt-1">Click "Add Highlight" to upload your first video.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {highlights.map((item) => {
            const thumbUrl = getThumbnailUrl(item);
            const calculatedDur = realDurations[item.id];
            const displayDuration = (calculatedDur && calculatedDur !== '0:00')
              ? calculatedDur
              : (item.duration && item.duration !== '0:00')
                ? item.duration
                : '';

            return (
              <div key={item.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm transition-colors group flex flex-col">
                <div 
                  onClick={() => setActiveVideo(item)}
                  className="relative aspect-video bg-slate-900 overflow-hidden cursor-pointer group-hover:shadow-inner"
                >
                  {thumbUrl ? (
                    <img 
                      src={getMediaUrl(thumbUrl)} 
                      alt={item.title} 
                      referrerPolicy="no-referrer"
                      className="w-full h-full object-cover opacity-90 sm:group-hover:scale-105 transition-transform duration-700 will-change-transform" 
                      loading="lazy"
                      decoding="async"
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        if (!target.dataset.triedFallback && item.videoUrl) {
                          target.dataset.triedFallback = 'true';
                          if (item.videoUrl.startsWith('/data/uploads/')) {
                            target.src = `/api${item.videoUrl}`;
                          }
                        }
                      }}
                    />
                  ) : item.videoUrl ? (
                    <video
                      src={getMediaUrl(item.videoUrl)}
                      preload="metadata"
                      muted
                      playsInline
                      className="w-full h-full object-cover opacity-90 sm:group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                      onError={(e) => {
                        const target = e.target as HTMLVideoElement;
                        if (!target.dataset.triedFallback && item.videoUrl) {
                          target.dataset.triedFallback = 'true';
                          if (item.videoUrl.startsWith('/data/uploads/')) {
                            target.src = `/api${item.videoUrl}`;
                          } else if (!item.videoUrl.startsWith('http')) {
                            target.src = `/api/data/uploads/${item.videoUrl.split('/').pop()}`;
                          }
                        }
                      }}
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-800">
                      <Video className="w-12 h-12 text-slate-600" />
                    </div>
                  )}

                  <div className="absolute inset-0 flex items-center justify-center bg-black/20 group-hover:bg-black/10 transition-colors">
                    <div className="w-12 h-12 rounded-full bg-emerald-500/90 text-white flex items-center justify-center shadow-lg shadow-emerald-500/30 transform group-hover:scale-110 transition-transform cursor-pointer">
                      <Play className="w-5 h-5 ml-1" />
                    </div>
                  </div>

                  <div className="absolute top-3 right-3 z-10">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(item.id);
                      }}
                      className="p-2 rounded-xl bg-black/40 text-white/70 hover:bg-red-500 hover:text-white  transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                  {displayDuration && (
                    <div className="absolute bottom-3 right-3 bg-black/70  px-2 py-0.5 rounded-md text-[10px] font-mono font-bold text-white shadow">
                      {displayDuration}
                    </div>
                  )}
                </div>
              
                <div className="p-4 sm:p-5 flex flex-col flex-grow">
                  <h3 className="font-bold text-slate-900 truncate mb-1 text-lg">{item.title}</h3>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 truncate max-w-[50%]">
                      {item.event}
                    </span>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200 truncate max-w-[50%]">
                      {item.stageName}
                    </span>
                  </div>
                  
                  <div className="space-y-1 mt-auto pt-3 border-t border-slate-100">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Performer</span>
                      <span className="font-semibold text-slate-900">{item.performer}</span>
                    </div>
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-slate-500">Views</span>
                      <span className="font-semibold text-slate-900">{item.views}</span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40  flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-lg shadow-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" /> Upload Highlight Video
              </h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleUpload} className="p-4 sm:p-5 space-y-4">
              {error && (
                <div className="p-3 bg-red-50 text-red-700 text-sm rounded-xl border border-red-100 font-medium flex items-center gap-2">
                  <AlertCircle className="w-4 h-4"/> {error}
                </div>
              )}
              
              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Video File (MP4) *</label>
                <input
                  type="file"
                  accept="video/mp4,video/x-m4v,video/*"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-colors cursor-pointer border border-slate-200 rounded-xl p-1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Highlight Title *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="e.g., Amazing Mappilappattu Performance"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Event/Competition *</label>
                  <input
                    type="text"
                    value={event}
                    onChange={(e) => setEvent(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="e.g., Mappilappattu"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Stage Name *</label>
                  <input
                    type="text"
                    value={stageName}
                    onChange={(e) => setStageName(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="e.g., Stage 1 - Imam Rabbani"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Performer(s) *</label>
                  <input
                    type="text"
                    value={performer}
                    onChange={(e) => setPerformer(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="e.g., Unit 42 Team"
                    required
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Duration (MM:SS) *</label>
                  <input
                    type="text"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                    placeholder="e.g., 04:30"
                    pattern="^[0-9]{1,2}:[0-9]{2}$"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex justify-end gap-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 text-sm font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 text-sm font-medium text-white bg-emerald-600 hover:bg-emerald-700 rounded-xl transition-colors shadow-sm shadow-emerald-500/20 flex items-center gap-2"
                >
                  <Upload className="w-4 h-4"/> Start Upload
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Video Preview Modal */}
      {activeVideo && (
        <div className="fixed inset-0 z-50 bg-slate-900/80  flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl max-w-4xl w-full overflow-hidden shadow-lg flex flex-col">
            <div className="p-4 border-b border-slate-800 flex justify-between items-center bg-slate-950">
              <h3 className="font-bold text-white text-base truncate">{activeVideo.title}</h3>
              <button 
                onClick={() => setActiveVideo(null)} 
                className="p-2 hover:bg-slate-800 text-slate-400 hover:text-white rounded-full transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="relative aspect-video bg-black flex items-center justify-center">
              {(() => {
                const { isYouTube, embedUrl } = getEmbedUrl(activeVideo.videoUrl);
                if (isYouTube) {
                  return (
                    <iframe
                      src={embedUrl}
                      title={activeVideo.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    />
                  );
                }
                return (
                  <video
                    src={getMediaUrl(activeVideo.videoUrl)}
                    title={activeVideo.title}
                    className="w-full h-full object-contain"
                    autoPlay
                    controls
                    playsInline
                    onError={(e) => {
                      const target = e.target as HTMLVideoElement;
                      if (!target.dataset.triedFallback && activeVideo.videoUrl) {
                        target.dataset.triedFallback = 'true';
                        if (activeVideo.videoUrl.startsWith('/data/uploads/')) {
                          target.src = `/api${activeVideo.videoUrl}`;
                        } else if (!activeVideo.videoUrl.startsWith('http')) {
                          target.src = `/api/data/uploads/${activeVideo.videoUrl.split('/').pop()}`;
                        }
                      }
                    }}
                  />
                );
              })()}
            </div>

            <div className="p-4 bg-slate-950 flex justify-between items-center text-xs text-slate-400 font-mono">
              <span>Performer: <strong className="text-white">{activeVideo.performer}</strong></span>
              <span>Event: <strong className="text-emerald-400">{activeVideo.event}</strong></span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
