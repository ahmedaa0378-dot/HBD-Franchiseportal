import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import {
  Search,
  FileText,
  Video,
  Image as ImageIcon,
  Download,
  Eye,
  Play,
  BookOpen,
  ChefHat,
  GraduationCap,
  Megaphone,
  ClipboardList,
  X,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
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
  created_at: string;
}

// ─── Constants ───────────────────────────────────────────────
const CATEGORIES = [
  { value: 'all', label: 'All', icon: BookOpen },
  { value: 'recipes', label: 'Recipes', icon: ChefHat },
  { value: 'training_videos', label: 'Training', icon: GraduationCap },
  { value: 'product_images', label: 'Images', icon: ImageIcon },
  { value: 'sop', label: 'SOPs', icon: ClipboardList },
  { value: 'marketing', label: 'Marketing', icon: Megaphone },
];

const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// ─── Component ───────────────────────────────────────────────
const ResourcesPage = () => {
  const [resources, setResources] = useState<Resource[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [previewResource, setPreviewResource] = useState<Resource | null>(null);

  useEffect(() => {
    fetchResources();
  }, []);

  const fetchResources = async () => {
    const { data } = await supabase
      .from('resources')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (data) setResources(data);
    setLoading(false);
  };

  const filteredResources = resources
    .filter(r => selectedCategory === 'all' || r.category === selectedCategory)
    .filter(r => {
      if (!searchQuery.trim()) return true;
      const q = searchQuery.toLowerCase();
      return r.title.toLowerCase().includes(q) || r.description?.toLowerCase().includes(q);
    });

  const categoryCounts = CATEGORIES.reduce((acc, cat) => {
    acc[cat.value] = cat.value === 'all'
      ? resources.length
      : resources.filter(r => r.category === cat.value).length;
    return acc;
  }, {} as Record<string, number>);

  // ─── Preview Navigation ────────────────────────────────────
  const currentPreviewIndex = previewResource
    ? filteredResources.findIndex(r => r.id === previewResource.id)
    : -1;

  const goToNext = () => {
    if (currentPreviewIndex < filteredResources.length - 1) {
      setPreviewResource(filteredResources[currentPreviewIndex + 1]);
    }
  };

  const goToPrev = () => {
    if (currentPreviewIndex > 0) {
      setPreviewResource(filteredResources[currentPreviewIndex - 1]);
    }
  };

  // ─── Loading ───────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <Header />
        <div className="flex items-center justify-center min-h-[400px]">
          <div className="animate-spin rounded-full h-12 w-12 border-4 border-brand-gold border-t-transparent"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-brand-cream">
      <Header />
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-6">
          <h1 className="font-display text-3xl font-semibold text-brand-black">Resources</h1>
          <p className="text-gray-600 mt-1">Recipes, training materials, and more</p>
        </div>

        {/* Category Tabs */}
        <div className="flex flex-wrap gap-2 mb-6">
          {CATEGORIES.map(cat => {
            const Icon = cat.icon;
            const count = categoryCounts[cat.value] || 0;
            return (
              <button
                key={cat.value}
                onClick={() => setSelectedCategory(cat.value)}
                className={`flex items-center gap-2 px-4 py-2 rounded-full text-sm font-medium transition ${
                  selectedCategory === cat.value
                    ? 'bg-brand-black text-white'
                    : 'bg-white text-gray-700 hover:bg-gray-100'
                }`}
              >
                <Icon size={16} />
                {cat.label}
                <span className={`text-xs ${
                  selectedCategory === cat.value ? 'text-gray-300' : 'text-gray-400'
                }`}>
                  {count}
                </span>
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
          <div className="bg-white rounded-2xl shadow-xl p-8 text-center">
            <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <h2 className="font-display text-2xl font-semibold text-brand-black mb-2">No resources found</h2>
            <p className="text-gray-600">
              {resources.length === 0
                ? 'Resources will appear here once uploaded by admin.'
                : 'Try a different search or category.'}
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredResources.map(resource => (
              <div
                key={resource.id}
                className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition cursor-pointer group"
                onClick={() => setPreviewResource(resource)}
              >
                {/* Thumbnail / Preview */}
                <div className="h-40 bg-gray-100 relative flex items-center justify-center overflow-hidden">
                  {resource.file_type === 'image' ? (
                    <img
                      src={resource.file_url}
                      alt={resource.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : resource.file_type === 'video' ? (
                    <div className="text-center">
                      <div className="w-14 h-14 rounded-full bg-brand-black/80 flex items-center justify-center mx-auto mb-2 group-hover:bg-brand-gold transition">
                        <Play size={24} className="text-white ml-1" />
                      </div>
                      <p className="text-xs text-gray-500">Training Video</p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <FileText size={36} className="mx-auto text-red-400 mb-2" />
                      <p className="text-xs text-gray-500">PDF Document</p>
                    </div>
                  )}

                  {/* File type tag */}
                  <span className="absolute top-2 right-2 bg-black/60 text-white text-xs px-2 py-0.5 rounded-full uppercase">
                    {resource.file_type}
                  </span>
                </div>

                {/* Info */}
                <div className="p-4">
                  <h3 className="font-semibold text-brand-black mb-1 truncate">{resource.title}</h3>
                  {resource.description && (
                    <p className="text-xs text-gray-500 line-clamp-2 mb-2">{resource.description}</p>
                  )}
                  <div className="flex items-center justify-between text-xs text-gray-400">
                    <span>{formatFileSize(resource.file_size)}</span>
                    <span>
                      {new Date(resource.created_at).toLocaleDateString('en-IN', {
                        day: 'numeric', month: 'short',
                      })}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── Preview Modal ─────────────────────────────────── */}
      {previewResource && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal Header */}
            <div className="px-6 py-4 border-b flex items-center justify-between shrink-0">
              <div className="min-w-0 flex-1 mr-4">
                <h2 className="text-lg font-bold text-gray-900 truncate">{previewResource.title}</h2>
                {previewResource.description && (
                  <p className="text-sm text-gray-500 truncate">{previewResource.description}</p>
                )}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {/* Navigation */}
                {filteredResources.length > 1 && (
                  <div className="flex items-center gap-1 mr-2">
                    <button
                      onClick={goToPrev}
                      disabled={currentPreviewIndex <= 0}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <span className="text-xs text-gray-400">
                      {currentPreviewIndex + 1}/{filteredResources.length}
                    </span>
                    <button
                      onClick={goToNext}
                      disabled={currentPreviewIndex >= filteredResources.length - 1}
                      className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-30 transition"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                )}
                <a
                  href={previewResource.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1 px-3 py-2 bg-brand-gold text-brand-black rounded-lg text-sm font-medium hover:bg-brand-gold-light transition"
                >
                  <ExternalLink size={14} />
                  Open
                </a>
                <a
                  href={previewResource.file_url}
                  download={previewResource.file_name}
                  className="flex items-center gap-1 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-200 transition"
                >
                  <Download size={14} />
                  Download
                </a>
                <button
                  onClick={() => setPreviewResource(null)}
                  className="p-2 text-gray-400 hover:text-gray-600 transition"
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            {/* Content Area */}
            <div className="flex-1 overflow-auto bg-gray-100">
              {previewResource.file_type === 'image' ? (
                <div className="flex items-center justify-center min-h-[400px] p-4">
                  <img
                    src={previewResource.file_url}
                    alt={previewResource.title}
                    className="max-w-full max-h-[70vh] object-contain rounded-lg shadow-lg"
                  />
                </div>
              ) : previewResource.file_type === 'video' ? (
                <div className="flex items-center justify-center min-h-[400px] p-4">
                  <video
                    controls
                    autoPlay
                    className="max-w-full max-h-[70vh] rounded-lg shadow-lg"
                    src={previewResource.file_url}
                  >
                    Your browser does not support the video tag.
                  </video>
                </div>
              ) : (
                <div className="h-[70vh]">
                  <iframe
                    src={`${previewResource.file_url}#toolbar=1`}
                    className="w-full h-full"
                    title={previewResource.title}
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ResourcesPage;