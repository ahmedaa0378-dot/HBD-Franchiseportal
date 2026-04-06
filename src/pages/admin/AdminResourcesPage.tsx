import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';
import {
  Upload,
  FileText,
  Video,
  Image as ImageIcon,
  Trash2,
  Plus,
  X,
  Search,
  Eye,
  Loader2,
  BookOpen,
  ChefHat,
  GraduationCap,
  Megaphone,
  ClipboardList,
  ExternalLink,
  File,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  file_url: string;
  file_name: string;
  file_type: string;
  file_size: number;
  thumbnail_url: string | null;
  is_active: boolean;
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────
const CATEGORIES = [
  { value: 'recipes', label: 'Recipes', icon: ChefHat, color: 'bg-orange-100 text-orange-700' },
  { value: 'training_videos', label: 'Training Videos', icon: GraduationCap, color: 'bg-blue-100 text-blue-700' },
  { value: 'product_images', label: 'Product Images', icon: ImageIcon, color: 'bg-green-100 text-green-700' },
  { value: 'sop', label: 'SOPs', icon: ClipboardList, color: 'bg-purple-100 text-purple-700' },
  { value: 'marketing', label: 'Marketing', icon: Megaphone, color: 'bg-pink-100 text-pink-700' },
];

const FILE_TYPE_ICONS: Record<string, typeof FileText> = {
  pdf: FileText,
  video: Video,
  image: ImageIcon,
};

const ACCEPTED_TYPES: Record<string, string> = {
  pdf: '.pdf',
  video: '.mp4,.mov,.webm,.avi',
  image: '.jpg,.jpeg,.png,.webp,.gif',
};

// ─── Helpers ─────────────────────────────────────────────────
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const detectFileType = (fileName: string): string => {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  if (ext === 'pdf') return 'pdf';
  if (['mp4', 'mov', 'webm', 'avi', 'mkv'].includes(ext)) return 'video';
  if (['jpg', 'jpeg', 'png', 'webp', 'gif', 'svg'].includes(ext)) return 'image';
  return 'pdf';
};

// ─── Component ───────────────────────────────────────────────
const AdminResourcesPage = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterCategory, setFilterCategory] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Upload modal state
  const [showUpload, setShowUpload] = useState(false);
  const [uploadTitle, setUploadTitle] = useState('');
  const [uploadDescription, setUploadDescription] = useState('');
  const [uploadCategory, setUploadCategory] = useState('recipes');
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState('');
  const [uploadError, setUploadError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Delete state
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    const { data } = await supabase
      .from('resources')
      .select('*')
      .order('created_at', { ascending: false });

    if (data) setResources(data);
    setLoading(false);
  };

  // ─── Upload ────────────────────────────────────────────────
  const handleUpload = async () => {
    if (!uploadFile || !uploadTitle.trim()) {
      setUploadError('Please provide a title and select a file');
      return;
    }

    setUploading(true);
    setUploadError('');
    setUploadProgress('Uploading file...');

    try {
      const fileType = detectFileType(uploadFile.name);
      const fileExt = uploadFile.name.split('.').pop();
      const filePath = `${uploadCategory}/${Date.now()}_${uploadFile.name.replace(/\s+/g, '_')}`;

      // Upload to Supabase Storage
      const { error: uploadErr } = await supabase.storage
        .from('resources')
        .upload(filePath, uploadFile, {
          cacheControl: '3600',
          upsert: false,
        });

      if (uploadErr) throw uploadErr;

      setUploadProgress('Saving resource...');

      // Get public URL
      const { data: urlData } = supabase.storage
        .from('resources')
        .getPublicUrl(filePath);

      const fileUrl = urlData.publicUrl;

      // Save to database
      const { error: dbErr } = await supabase.from('resources').insert({
        title: uploadTitle.trim(),
        description: uploadDescription.trim(),
        category: uploadCategory,
        file_url: fileUrl,
        file_name: uploadFile.name,
        file_type: fileType,
        file_size: uploadFile.size,
      });

      if (dbErr) throw dbErr;

      // Reset & refresh
      resetUploadForm();
      await fetchResources();
    } catch (err: any) {
      setUploadError(err.message);
    }

    setUploading(false);
    setUploadProgress('');
  };

  const resetUploadForm = () => {
    setShowUpload(false);
    setUploadTitle('');
    setUploadDescription('');
    setUploadCategory('recipes');
    setUploadFile(null);
    setUploadError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // ─── Delete ────────────────────────────────────────────────
  const handleDelete = async (resource: Resource) => {
    setDeleting(true);

    try {
      // Extract storage path from URL
      const urlParts = resource.file_url.split('/resources/');
      if (urlParts.length > 1) {
        const storagePath = decodeURIComponent(urlParts[1]);
        await supabase.storage.from('resources').remove([storagePath]);
      }

      await supabase.from('resources').delete().eq('id', resource.id);
      setResources(prev => prev.filter(r => r.id !== resource.id));
    } catch (err) {
      console.error('Delete error:', err);
    }

    setDeleting(false);
    setDeleteId(null);
  };

  // ─── Toggle Active ─────────────────────────────────────────
  const toggleActive = async (resource: Resource) => {
    await supabase
      .from('resources')
      .update({ is_active: !resource.is_active })
      .eq('id', resource.id);

    setResources(prev =>
      prev.map(r => r.id === resource.id ? { ...r, is_active: !r.is_active } : r)
    );
  };

  // ─── Filter ────────────────────────────────────────────────
  const filteredResources = resources
    .filter(r => filterCategory === 'all' || r.category === filterCategory)
    .filter(r => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.file_name.toLowerCase().includes(q);
    });

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = resources.filter(r => r.category === cat.value).length;
    return acc;
  }, {} as Record<string, number>);

  const getCategoryConfig = (category: string) => {
    return CATEGORIES.find(c => c.value === category) || CATEGORIES[0];
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-gold border-t-transparent"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Resource Library</h1>
          <p className="text-gray-600 mt-1">Upload recipes, training videos, and materials for franchises</p>
        </div>
        <button
          onClick={() => setShowUpload(true)}
          className="flex items-center gap-2 bg-brand-gold text-brand-black px-5 py-3 rounded-lg font-medium hover:bg-brand-gold-light transition"
        >
          <Upload size={18} />
          Upload Resource
        </button>
      </div>

      {/* Category Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 mb-6">
        {CATEGORIES.map(cat => {
          const Icon = cat.icon;
          return (
            <button
              key={cat.value}
              onClick={() => setFilterCategory(filterCategory === cat.value ? 'all' : cat.value)}
              className={`rounded-xl p-3 text-center transition border ${
                filterCategory === cat.value
                  ? 'border-brand-gold bg-amber-50'
                  : 'border-gray-200 bg-white hover:bg-gray-50'
              }`}
            >
              <Icon size={20} className="mx-auto mb-1 text-gray-500" />
              <p className="text-lg font-bold text-gray-900">{categoryCounts[cat.value] || 0}</p>
              <p className="text-xs text-gray-500">{cat.label}</p>
            </button>
          );
        })}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Search resources..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none shadow-sm"
        />
      </div>

      {/* Resources Grid */}
      {filteredResources.length === 0 ? (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h2 className="text-xl font-semibold text-gray-900 mb-2">
            {resources.length === 0 ? 'No resources uploaded yet' : 'No resources match your filter'}
          </h2>
          <p className="text-gray-500 text-sm">
            {resources.length === 0
              ? 'Upload recipes, training videos, and other materials for your franchises.'
              : 'Try a different search or category.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredResources.map(resource => {
            const catConfig = getCategoryConfig(resource.category);
            const CatIcon = catConfig.icon;
            const FileIcon = FILE_TYPE_ICONS[resource.file_type] || File;

            return (
              <div
                key={resource.id}
                className={`bg-white rounded-xl shadow-md overflow-hidden transition ${
                  !resource.is_active ? 'opacity-60' : ''
                }`}
              >
                {/* Preview area */}
                <div className="h-36 bg-gray-100 relative flex items-center justify-center">
                  {resource.file_type === 'image' ? (
                    <img
                      src={resource.file_url}
                      alt={resource.title}
                      className="w-full h-full object-cover"
                    />
                  ) : resource.file_type === 'video' ? (
                    <div className="text-center">
                      <Video size={36} className="mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-400">Video</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileText size={36} className="mx-auto text-gray-400 mb-1" />
                      <p className="text-xs text-gray-400">PDF Document</p>
                    </div>
                  )}

                  {/* Category badge */}
                  <span className={`absolute top-2 left-2 inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${catConfig.color}`}>
                    <CatIcon size={12} />
                    {catConfig.label}
                  </span>

                  {/* File type badge */}
                  <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full uppercase">
                    {resource.file_type}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-1 truncate">{resource.title}</h3>
                  {resource.description && (
                    <p className="text-xs text-gray-500 mb-2 line-clamp-2">{resource.description}</p>
                  )}
                  <div className="flex items-center gap-2 text-xs text-gray-400 mb-3">
                    <span>{formatFileSize(resource.file_size)}</span>
                    <span>·</span>
                    <span>
                      {new Date(resource.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short', year: 'numeric',
                      })}
                    </span>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2">
                    <a
                      href={resource.file_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 flex items-center justify-center gap-1 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                    >
                      <Eye size={14} />
                      View
                    </a>
                    <button
                      onClick={() => toggleActive(resource)}
                      className={`px-3 py-2 rounded-lg text-sm font-medium transition ${
                        resource.is_active
                          ? 'bg-green-50 text-green-700 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                      }`}
                    >
                      {resource.is_active ? 'Active' : 'Hidden'}
                    </button>
                    <button
                      onClick={() => setDeleteId(resource.id)}
                      className="p-2 text-gray-400 hover:text-red-500 transition"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>

                {/* Delete Confirmation */}
                {deleteId === resource.id && (
                  <div className="px-4 pb-4">
                    <div className="bg-red-50 rounded-lg p-3">
                      <p className="text-sm text-red-700 mb-2">Delete this resource?</p>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleDelete(resource)}
                          disabled={deleting}
                          className="flex-1 bg-red-600 text-white py-1.5 rounded-lg text-sm font-medium hover:bg-red-700 disabled:opacity-50"
                        >
                          {deleting ? 'Deleting...' : 'Yes, Delete'}
                        </button>
                        <button
                          onClick={() => setDeleteId(null)}
                          className="flex-1 bg-white text-gray-700 py-1.5 rounded-lg text-sm font-medium border hover:bg-gray-50"
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ─── Upload Modal ────────────────────────────────────── */}
      {showUpload && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">Upload Resource</h2>
              <button onClick={resetUploadForm} className="text-gray-400 hover:text-gray-600">
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-5">
              {uploadError && (
                <div className="bg-red-50 text-red-600 p-3 rounded-lg text-sm">{uploadError}</div>
              )}

              {/* Category */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <div className="grid grid-cols-2 gap-2">
                  {CATEGORIES.map(cat => {
                    const Icon = cat.icon;
                    return (
                      <button
                        key={cat.value}
                        onClick={() => setUploadCategory(cat.value)}
                        className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition ${
                          uploadCategory === cat.value
                            ? 'border-brand-gold bg-amber-50 font-medium'
                            : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                        }`}
                      >
                        <Icon size={16} />
                        {cat.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <input
                  type="text"
                  value={uploadTitle}
                  onChange={(e) => setUploadTitle(e.target.value)}
                  placeholder="e.g., Cappuccino Recipe, Barista Training Module 1"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none"
                />
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
                <textarea
                  value={uploadDescription}
                  onChange={(e) => setUploadDescription(e.target.value)}
                  placeholder="Brief description of the resource..."
                  rows={2}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-gold focus:border-transparent outline-none resize-none"
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">File *</label>
                <div
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center cursor-pointer hover:border-brand-gold hover:bg-amber-50/30 transition"
                >
                  {uploadFile ? (
                    <div>
                      <File size={24} className="mx-auto text-brand-gold mb-2" />
                      <p className="text-sm font-medium text-gray-900">{uploadFile.name}</p>
                      <p className="text-xs text-gray-500 mt-1">{formatFileSize(uploadFile.size)}</p>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setUploadFile(null);
                          if (fileInputRef.current) fileInputRef.current.value = '';
                        }}
                        className="text-xs text-red-500 hover:underline mt-2"
                      >
                        Remove
                      </button>
                    </div>
                  ) : (
                    <div>
                      <Upload size={24} className="mx-auto text-gray-400 mb-2" />
                      <p className="text-sm text-gray-600">Click to upload</p>
                      <p className="text-xs text-gray-400 mt-1">
                        PDF, MP4, MOV, JPG, PNG, WEBP (max 50MB)
                      </p>
                    </div>
                  )}
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.mp4,.mov,.webm,.avi,.jpg,.jpeg,.png,.webp,.gif"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      if (file.size > 50 * 1024 * 1024) {
                        setUploadError('File size must be under 50MB');
                        return;
                      }
                      setUploadFile(file);
                      setUploadError('');
                    }
                  }}
                  className="hidden"
                />
              </div>
            </div>

            {/* Upload Actions */}
            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={resetUploadForm}
                className="flex-1 py-3 border border-gray-300 rounded-lg font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleUpload}
                disabled={uploading || !uploadFile || !uploadTitle.trim()}
                className="flex-1 bg-brand-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {uploading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    {uploadProgress}
                  </>
                ) : (
                  <>
                    <Upload size={16} />
                    Upload
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default AdminResourcesPage;