import { useState, useEffect, useRef } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface Category {
  id: string;
  name: string;
}

interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  unit: string;
  min_order_qty: number;
  image_url: string;
  stock_quantity: number;
  reorder_threshold: number;
  gst_rate: number; // ADD THIS
  hsn_code: string; // ADD THIS
  is_active: boolean;
  categories?: { name: string };
}

const emptyProduct = {
  category_id: '',
  name: '',
  description: '',
  sku: '',
  price: 0,
  unit: 'piece',
  min_order_qty: 1,
  image_url: '',
  stock_quantity: 0,
  reorder_threshold: 10,
  gst_rate: 18, // ADD THIS
  hsn_code: '', // ADD THIS
  is_active: true
};

const ProductsPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Partial<Product> | null>(null);
  const [formData, setFormData] = useState(emptyProduct);
  const [saving, setSaving] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [uploading, setUploading] = useState(false);
  const [imagePreview, setImagePreview] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [prodRes, catRes] = await Promise.all([
      supabase.from('products').select('*, categories(name)').order('sort_order'),
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order')
    ]);

    if (prodRes.data) setProducts(prodRes.data);
    if (catRes.data) setCategories(catRes.data);
    setLoading(false);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please select an image file');
      return;
    }

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Image size should be less than 2MB');
      return;
    }

    setUploading(true);

    try {
      // Create unique filename
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
      const filePath = `products/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file);

      if (uploadError) throw uploadError;

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);

      // Update form data
      setFormData({ ...formData, image_url: publicUrl });
      setImagePreview(publicUrl);

    } catch (err: any) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveImage = async () => {
    if (formData.image_url && formData.image_url.includes('product-images')) {
      // Extract file path from URL
      const urlParts = formData.image_url.split('product-images/');
      if (urlParts[1]) {
        await supabase.storage.from('product-images').remove([urlParts[1]]);
      }
    }
    setFormData({ ...formData, image_url: '' });
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setFormData({
      category_id: product.category_id,
      name: product.name,
      description: product.description || '',
      sku: product.sku || '',
      price: product.price,
      unit: product.unit,
      min_order_qty: product.min_order_qty,
      image_url: product.image_url || '',
      stock_quantity: product.stock_quantity,
      reorder_threshold: product.reorder_threshold,
      is_active: product.is_active
    });
    setImagePreview(product.image_url || '');
    setShowModal(true);
  };

  const handleAdd = () => {
    setEditingProduct(null);
    setFormData(emptyProduct);
    setImagePreview('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setImagePreview('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleSave = async () => {
    setSaving(true);

    try {
      if (editingProduct?.id) {
        // Update existing
        const { error } = await supabase
          .from('products')
          .update(formData)
          .eq('id', editingProduct.id);

        if (error) throw error;
      } else {
        // Create new
        const { error } = await supabase
          .from('products')
          .insert(formData);

        if (error) throw error;
      }

      await fetchData();
      handleCloseModal();
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (product: Product) => {
    if (!confirm(`Delete "${product.name}"? This cannot be undone.`)) return;

    // Delete image from storage if exists
    if (product.image_url && product.image_url.includes('product-images')) {
      const urlParts = product.image_url.split('product-images/');
      if (urlParts[1]) {
        await supabase.storage.from('product-images').remove([urlParts[1]]);
      }
    }

    const { error } = await supabase
      .from('products')
      .delete()
      .eq('id', product.id);

    if (!error) {
      setProducts(prev => prev.filter(p => p.id !== product.id));
    }
  };

  const handleToggleActive = async (product: Product) => {
    const { error } = await supabase
      .from('products')
      .update({ is_active: !product.is_active })
      .eq('id', product.id);

    if (!error) {
      setProducts(prev =>
        prev.map(p => p.id === product.id ? { ...p, is_active: !p.is_active } : p)
      );
    }
  };

  const filteredProducts = selectedCategory === 'all'
    ? products
    : products.filter(p => p.category_id === selectedCategory);

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
          <h1 className="text-3xl font-bold text-gray-900">Products</h1>
          <p className="text-gray-600 mt-1">Manage your product catalog</p>
        </div>
        <button
          onClick={handleAdd}
          className="bg-brand-gold text-brand-black px-6 py-3 rounded-lg font-medium hover:bg-brand-gold-light transition"
        >
          + Add Product
        </button>
      </div>

      {/* Category Filter */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          onClick={() => setSelectedCategory('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            selectedCategory === 'all'
              ? 'bg-brand-black text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          All ({products.length})
        </button>
        {categories.map(cat => (
          <button
            key={cat.id}
            onClick={() => setSelectedCategory(cat.id)}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
              selectedCategory === cat.id
                ? 'bg-brand-black text-white'
                : 'bg-white text-gray-600 hover:bg-gray-100'
            }`}
          >
            {cat.name} ({products.filter(p => p.category_id === cat.id).length})
          </button>
        ))}
      </div>

      {/* Products Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredProducts.map(product => (
          <div key={product.id} className={`bg-white rounded-xl shadow-md overflow-hidden ${!product.is_active ? 'opacity-60' : ''}`}>
            <div className="h-32 bg-brand-cream flex items-center justify-center relative">
              {product.image_url ? (
                <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
              ) : (
                <span className="text-4xl opacity-30">📦</span>
              )}
              {!product.is_active && (
                <span className="absolute top-2 right-2 bg-gray-800 text-white text-xs px-2 py-1 rounded">
                  Inactive
                </span>
              )}
              {product.stock_quantity <= product.reorder_threshold && product.is_active && (
                <span className="absolute top-2 right-2 bg-red-500 text-white text-xs px-2 py-1 rounded">
                  Low Stock
                </span>
              )}
            </div>
            <div className="p-4">
              <p className="text-xs text-brand-gold font-medium">{product.categories?.name}</p>
              <h3 className="font-semibold text-gray-900 mt-1">{product.name}</h3>
              <p className="text-sm text-gray-500 mt-1">SKU: {product.sku || '-'}</p>
              
              <div className="flex items-center justify-between mt-3">
                <span className="text-lg font-bold">₹{product.price}/{product.unit}</span>
                <span className="text-sm text-gray-500">Stock: {product.stock_quantity}</span>
              </div>

              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => handleEdit(product)}
                  className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                >
                  Edit
                </button>
                <button
                  onClick={() => handleToggleActive(product)}
                  className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                    product.is_active
                      ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                      : 'bg-green-100 text-green-700 hover:bg-green-200'
                  }`}
                >
                  {product.is_active ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => handleDelete(product)}
                  className="px-3 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                >
                  🗑
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {filteredProducts.length === 0 && (
        <div className="bg-white rounded-xl shadow-md p-12 text-center">
          <p className="text-gray-500">No products found</p>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingProduct?.id ? 'Edit Product' : 'Add New Product'}
                </h2>
                <button onClick={handleCloseModal} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Image Upload Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Product Image</label>
                <div className="flex items-start gap-4">
                  {/* Preview */}
                  <div className="w-32 h-32 bg-gray-100 rounded-lg flex items-center justify-center overflow-hidden border-2 border-dashed border-gray-300">
                    {imagePreview || formData.image_url ? (
                      <img 
                        src={imagePreview || formData.image_url} 
                        alt="Preview" 
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="text-3xl opacity-30">📷</span>
                    )}
                  </div>

                  {/* Upload Controls */}
                  <div className="flex-1">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleImageUpload}
                      className="hidden"
                      id="image-upload"
                    />
                    <label
                      htmlFor="image-upload"
                      className={`inline-block px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition ${
                        uploading 
                          ? 'bg-gray-200 text-gray-500 cursor-not-allowed' 
                          : 'bg-brand-gold text-brand-black hover:bg-brand-gold-light'
                      }`}
                    >
                      {uploading ? 'Uploading...' : '📤 Upload Image'}
                    </label>
                    
                    {(imagePreview || formData.image_url) && (
                      <button
                        onClick={handleRemoveImage}
                        className="ml-2 px-4 py-2 rounded-lg text-sm font-medium bg-red-100 text-red-700 hover:bg-red-200"
                      >
                        Remove
                      </button>
                    )}

                    <p className="text-xs text-gray-500 mt-2">
                      JPG, PNG up to 2MB. Recommended: 400×400px
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-4">
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Product Name *</label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                    placeholder="e.g., Premium Coffee Beans"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
                  <select
                    value={formData.category_id}
                    onChange={(e) => setFormData({ ...formData, category_id: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  >
                    <option value="">Select Category</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">SKU</label>
                  <input
                    type="text"
                    value={formData.sku}
                    onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                    placeholder="e.g., COF-001"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Price (₹) *</label>
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={formData.price}
                    onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  />
                </div>
               {/* GST Rate Field */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">GST Rate (%)</label>
  <select
    value={formData.gst_rate || 18}
    onChange={(e) => setFormData({ 
      ...formData, 
      gst_rate: parseFloat(e.target.value) 
    })}
    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
  >
    <option value="0">0% - Exempt</option>
    <option value="5">5% GST</option>
    <option value="12">12% GST</option>
    <option value="18">18% GST</option>
    <option value="28">28% GST</option>
  </select>
</div>

{/* HSN Code Field */}
<div>
  <label className="block text-sm font-medium text-gray-700 mb-1">
    HSN Code
    <span className="text-xs text-gray-500 ml-2">(Optional)</span>
  </label>
  <input
    type="text"
    maxLength={8}
    value={formData.hsn_code || ''}
    onChange={(e) => setFormData({ ...formData, hsn_code: e.target.value })}
    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
    placeholder="e.g., 09011011"
  />
</div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
                  <select
                    value={formData.unit}
                    onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  >
                    <option value="piece">Piece</option>
                    <option value="kg">Kilogram (kg)</option>
                    <option value="pack">Pack</option>
                    <option value="box">Box</option>
                    <option value="tub">Tub</option>
                    <option value="liter">Liter</option>
                    <option value="dozen">Dozen</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.stock_quantity}
                    onChange={(e) => setFormData({ ...formData, stock_quantity: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reorder Threshold</label>
                  <input
                    type="number"
                    min="0"
                    value={formData.reorder_threshold}
                    onChange={(e) => setFormData({ ...formData, reorder_threshold: parseInt(e.target.value) || 0 })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                    rows={2}
                    placeholder="Product description..."
                  />
                </div>

                <div className="md:col-span-2">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.is_active}
                      onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                      className="w-4 h-4 text-brand-gold"
                    />
                    <span className="text-sm text-gray-700">Active (visible to franchises)</span>
                  </label>
                </div>
              </div>
            </div>

            <div className="p-6 border-t bg-gray-50 flex gap-3">
              <button
                onClick={handleCloseModal}
                className="flex-1 bg-gray-200 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-300 transition"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || !formData.category_id || formData.price <= 0}
                className="flex-1 bg-brand-black text-white py-3 rounded-lg font-medium hover:bg-gray-800 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save Product'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default ProductsPage;
