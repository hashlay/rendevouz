import React, { useState, useEffect } from 'react';
import { Upload, Trash2, Image as ImageIcon, Plus, X, Star, Loader2, CheckCircle2, AlertCircle } from 'lucide-react';
import { GalleryItem, User } from '../types';

interface GalleryStudioProps {
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

export default function GalleryStudio({ user }: GalleryStudioProps) {
  const [gallery, setGallery] = useState<GalleryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [backgroundTasks, setBackgroundTasks] = useState<BackgroundTask[]>(() => {
    try {
      const saved = localStorage.getItem('rendezvous_bg_tasks_gallery');
      const parsed: BackgroundTask[] = saved ? JSON.parse(saved) : [];
      // Only keep failed tasks from previous sessions; clear stale 'uploading' tasks on boot
      return parsed.filter(t => t.status === 'failed');
    } catch (e) {
      return [];
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem('rendezvous_bg_tasks_gallery', JSON.stringify(backgroundTasks));
    } catch (e) {}
  }, [backgroundTasks]);

  // Form state
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<GalleryItem['category']>('Campus');
  const [caption, setCaption] = useState('');
  const [photographer, setPhotographer] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [imageFile, setImageFile] = useState<File | null>(null);

  const categories = ['Inauguration', 'Performances', 'Literary', 'Exhibition', 'Crowd & Life', 'Competitions', 'Awarding', 'Campus'];

  useEffect(() => {
    fetchGallery();
  }, []);

  const fetchGallery = async () => {
    try {
      const response = await fetch('/api/gallery', {
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        const data = await response.json();
        setGallery(data);
      }
    } catch (err) {
      console.error('Failed to fetch gallery', err);
    } finally {
      setLoading(false);
    }
  };

  const handleUpload = (e: React.FormEvent) => {
    e.preventDefault();
    if (!imageFile) {
      setError('Please select an image file.');
      return;
    }

    const tempId = 'task_' + Date.now();
    const taskTitle = title || imageFile.name;
    
    // Add to background tasks
    setBackgroundTasks(prev => [...prev, { id: tempId, title: taskTitle, status: 'uploading' }]);
    
    const formData = new FormData();
    formData.append('title', title);
    formData.append('category', category || 'Campus');
    formData.append('caption', caption);
    formData.append('photographer', photographer);
    formData.append('date', date);
    formData.append('image', imageFile);

    // Close modal instantly and clear form
    setIsModalOpen(false);
    resetForm();

    // Perform upload in background
    fetch('/api/gallery/upload', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${localStorage.getItem('token')}`
      },
      body: formData
    })
    .then(async (response) => {
      if (response.ok) {
        await fetchGallery();
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
    if (!window.confirm('Are you sure you want to delete this photo?')) return;
    try {
      const response = await fetch(`/api/gallery/${id}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${localStorage.getItem('token')}` }
      });
      if (response.ok) {
        fetchGallery();
      }
    } catch (err) {
      console.error('Failed to delete photo', err);
    }
  };

  const handleToggleFeatured = async (id: string, currentStatus: boolean) => {
    if (!currentStatus) {
      const featuredCount = gallery.filter(item => item.isFeatured).length;
      if (featuredCount >= 8) {
        alert('You can only feature up to 8 images on the homepage.');
        return;
      }
    }
    try {
      const response = await fetch(`/api/gallery/${id}/featured`, {
        method: 'PUT',
        headers: { 
          'Authorization': `Bearer ${localStorage.getItem('token')}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ isFeatured: !currentStatus })
      });
      if (response.ok) {
        fetchGallery();
      } else {
        const data = await response.json();
        alert(data.error || 'Failed to update featured status');
      }
    } catch (err) {
      console.error('Failed to update featured status', err);
    }
  };

  const dismissTask = (id: string) => {
    setBackgroundTasks(prev => prev.filter(t => t.id !== id));
  };

  const resetForm = () => {
    setTitle('');
    setCategory('Campus' as any);
    setCaption('');
    setPhotographer('');
    setDate(new Date().toISOString().split('T')[0]);
    setImageFile(null);
    setError('');
  };

  const featuredCount = gallery.filter(item => item.isFeatured).length;

  if (loading) return <div className="p-6 text-slate-500 flex items-center gap-2"><Loader2 className="animate-spin w-5 h-5"/> Loading gallery...</div>;

  return (
    <div className="p-4 sm:p-6 space-y-6 max-w-7xl mx-auto font-sans min-w-0 w-full overflow-x-hidden">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-5 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ImageIcon className="text-emerald-500 w-6 h-6" />
            Photo Gallery
          </h2>
          <p className="text-sm text-slate-500 mt-1">Manage public event photos. ({featuredCount}/8 Featured on Home)</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-xl transition-all shadow-sm shadow-emerald-500/20 font-medium text-sm"
        >
          <Plus className="w-4 h-4" /> Add Photo
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

      {gallery.length === 0 && backgroundTasks.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-2xl border border-slate-200/80 border-dashed">
          <ImageIcon className="w-12 h-12 text-slate-300 mx-auto mb-3" />
          <h3 className="text-slate-900 font-medium">No Photos Uploaded</h3>
          <p className="text-slate-500 text-sm mt-1">Click "Add Photo" to upload your first image.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {gallery.map((item) => (
            <div key={item.id} className="bg-white rounded-2xl border border-slate-200/80 overflow-hidden shadow-sm transition-colors group flex flex-col">
              <div className="relative aspect-video overflow-hidden bg-slate-100">
                <img 
                  src={getMediaUrl(item.imageUrl)} 
                  alt={item.title} 
                  className="w-full h-full object-cover will-change-transform transition-transform duration-500 sm:group-hover:scale-105" 
                  loading="lazy" 
                  decoding="async" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    if (!target.dataset.triedFallback && item.imageUrl) {
                      target.dataset.triedFallback = 'true';
                      if (item.imageUrl.startsWith('/data/uploads/')) {
                        target.src = `/api${item.imageUrl}`;
                      } else if (!item.imageUrl.startsWith('http')) {
                        target.src = `https://rendevouz-8sfp.onrender.com${item.imageUrl.startsWith('/') ? item.imageUrl : '/' + item.imageUrl}`;
                      }
                    }
                  }}
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  <button
                    onClick={() => handleToggleFeatured(item.id, !!item.isFeatured)}
                    className={`p-1.5 rounded-lg  transition-colors ${item.isFeatured ? 'bg-amber-400 text-white shadow-lg' : 'bg-black/40 text-white/70 hover:bg-black/60'}`}
                    title={item.isFeatured ? "Unfeature from Home" : "Feature on Home (Max 8)"}
                  >
                    <Star className={`w-4 h-4 ${item.isFeatured ? 'fill-current' : ''}`} />
                  </button>
                  <button
                    onClick={() => handleDelete(item.id)}
                    className="p-1.5 rounded-lg bg-black/40 text-white/70 hover:bg-red-500 hover:text-white  transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
              <div className="p-4 flex flex-col flex-grow">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold text-slate-900 truncate pr-2">{item.title}</h3>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200 whitespace-nowrap">
                    {item.category}
                  </span>
                </div>
                <p className="text-xs text-slate-500 line-clamp-2 mt-1 flex-grow">{item.caption || 'No caption provided'}</p>
                <div className="mt-4 flex items-center justify-between text-[10px] text-slate-400 font-medium">
                  <span>{item.date}</span>
                  {item.photographer && <span>📸 {item.photographer}</span>}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload Modal */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40  flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl border border-slate-200 w-full max-w-md shadow-lg overflow-hidden animate-in fade-in zoom-in duration-200">
            <div className="flex justify-between items-center p-4 sm:p-5 border-b border-slate-100 bg-slate-50/50">
              <h3 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                <Upload className="w-5 h-5 text-emerald-500" /> Upload Photo
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
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Photo Image *</label>
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setImageFile(e.target.files?.[0] || null)}
                  className="w-full text-sm text-slate-500 file:mr-4 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-emerald-50 file:text-emerald-700 hover:file:bg-emerald-100 transition-colors cursor-pointer border border-slate-200 rounded-xl p-1"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Title</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="e.g., Grand Finale Opening"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Category</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value as any)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  >
                    {categories.map(c => (
                      <option key={c} value={c}>{c}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Date</label>
                  <input
                    type="date"
                    value={date}
                    onChange={(e) => setDate(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Caption (Optional)</label>
                <textarea
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all h-20 resize-none"
                  placeholder="Describe the moment..."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 uppercase tracking-wider mb-1.5">Photographer (Optional)</label>
                <input
                  type="text"
                  value={photographer}
                  onChange={(e) => setPhotographer(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-xl text-sm text-slate-900 focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 outline-none transition-all"
                  placeholder="e.g., John Doe"
                />
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
    </div>
  );
}
