import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface Product {
  id: string;
  name: string;
  price: number;
  unit: string;
  gst_rate: number;
}

interface BundleItem {
  product_id: string;
  quantity: number;
  products?: Product;
}

interface Bundle {
  id: string;
  name: string;
  description: string;
  bundle_type: string;
  discount_percentage: number;
  is_active: boolean;
  sort_order: number;
  bundle_items?: BundleItem[];
}

const BundlesPage = () => {
  const [bundles, setBundles] = useState<Bundle[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingBundle, setEditingBundle] = useState<Bundle | null>(null);
  const [saving, setSaving] = useState(false);
  
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    bundle_type: 'starter',
    discount_percentage: 0,
    is_active: true,
    sort_order: 0
  });

  const [selectedProducts, setSelectedProducts] = useState<Array<{product_id: string, quantity: number}>>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    // Fetch bundles
    const { data: bundlesData } = await supabase
      .from('product_bundles')
      .select(`
        *,
        bundle_items(
          product_id,
          quantity,
          products(id, name, price, unit, gst_rate)
        )
      `)
      .order('sort_order');

    if (bundlesData) setBundles(bundlesData);

    // Fetch products for selection
    const { data: productsData } = await supabase
      .from('products')
      .select('id, name, price, unit, gst_rate')
      .eq('is_active', true)
      .order('name');

    if (productsData) setProducts(productsData);

    setLoading(false);
  };

  const handleCreate = () => {
    setEditingBundle(null);
    setFormData({
      name: '',
      description: '',
      bundle_type: 'starter',
      discount_percentage: 0,
      is_active: true,
      sort_order: 0
    });
    setSelectedProducts([]);
    setShowModal(true);
  };

  const handleEdit = (bundle: Bundle) => {
    setEditingBundle(bundle);
    setFormData({
      name: bundle.name,
      description: bundle.description,
      bundle_type: bundle.bundle_type,
      discount_percentage: bundle.discount_percentage,
      is_active: bundle.is_active,
      sort_order: bundle.sort_order
    });
    setSelectedProducts(
      bundle.bundle_items?.map(item => ({
        product_id: item.product_id,
        quantity: item.quantity
      })) || []
    );
    setShowModal(true);
  };

  const handleSave = async () => {
    if (!formData.name || selectedProducts.length === 0) {
      alert('Please enter bundle name and select at least one product');
      return;
    }

    setSaving(true);

    try {
      if (editingBundle) {
        // Update existing bundle
        const { error: bundleError } = await supabase
          .from('product_bundles')
          .update(formData)
          .eq('id', editingBundle.id);

        if (bundleError) throw bundleError;

        // Delete existing bundle items
        await supabase
          .from('bundle_items')
          .delete()
          .eq('bundle_id', editingBundle.id);

        // Insert new bundle items
        const { error: itemsError } = await supabase
          .from('bundle_items')
          .insert(
            selectedProducts.map(item => ({
              bundle_id: editingBundle.id,
              product_id: item.product_id,
              quantity: item.quantity
            }))
          );

        if (itemsError) throw itemsError;
      } else {
        // Create new bundle
        const { data: newBundle, error: bundleError } = await supabase
          .from('product_bundles')
          .insert(formData)
          .select()
          .single();

        if (bundleError) throw bundleError;

        // Insert bundle items
        const { error: itemsError } = await supabase
          .from('bundle_items')
          .insert(
            selectedProducts.map(item => ({
              bundle_id: newBundle.id,
              product_id: item.product_id,
              quantity: item.quantity
            }))
          );

        if (itemsError) throw itemsError;
      }

      await fetchData();
      setShowModal(false);
      alert('✅ Bundle saved successfully');
    } catch (error: any) {
      alert('❌ Error: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (bundleId: string) => {
    if (!confirm('Are you sure you want to delete this bundle?')) return;

    const { error } = await supabase
      .from('product_bundles')
      .delete()
      .eq('id', bundleId);

    if (!error) {
      await fetchData();
      alert('✅ Bundle deleted');
    }
  };

  const handleToggleActive = async (bundle: Bundle) => {
    const { error } = await supabase
      .from('product_bundles')
      .update({ is_active: !bundle.is_active })
      .eq('id', bundle.id);

    if (!error) {
      setBundles(prev =>
        prev.map(b => b.id === bundle.id ? { ...b, is_active: !b.is_active } : b)
      );
    }
  };

  const addProductToBundle = () => {
    setSelectedProducts([...selectedProducts, { product_id: '', quantity: 1 }]);
  };

  const updateBundleProduct = (index: number, field: 'product_id' | 'quantity', value: string | number) => {
    const updated = [...selectedProducts];
    updated[index] = { ...updated[index], [field]: value };
    setSelectedProducts(updated);
  };

  const removeBundleProduct = (index: number) => {
    setSelectedProducts(selectedProducts.filter((_, i) => i !== index));
  };

  const calculateBundleTotal = (bundleItems: BundleItem[], discountPercentage: number) => {
    const subtotal = bundleItems.reduce((sum, item) => {
      const product = products.find(p => p.id === item.product_id);
      return sum + (product ? product.price * item.quantity : 0);
    }, 0);
    const discount = (subtotal * discountPercentage) / 100;
    return subtotal - discount;
  };

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
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Product Bundles</h1>
          <p className="text-gray-600 mt-1">Create starter packs and weekly bundles</p>
        </div>
        <button
          onClick={handleCreate}
          className="bg-brand-gold text-brand-black px-6 py-3 rounded-lg font-semibold hover:bg-yellow-500 transition"
        >
          + Create Bundle
        </button>
      </div>

      {/* Bundles Grid */}
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {bundles.map(bundle => {
          const bundleTotal = calculateBundleTotal(bundle.bundle_items || [], bundle.discount_percentage);
          
          return (
            <div key={bundle.id} className={`bg-white rounded-xl shadow-md overflow-hidden ${!bundle.is_active ? 'opacity-60' : ''}`}>
              <div className="p-6">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-gray-900 text-lg">{bundle.name}</h3>
                    <span className={`inline-block px-2 py-1 rounded text-xs font-medium mt-1 ${
                      bundle.bundle_type === 'starter' ? 'bg-blue-100 text-blue-800' :
                      bundle.bundle_type === 'weekly' ? 'bg-green-100 text-green-800' :
                      'bg-purple-100 text-purple-800'
                    }`}>
                      {bundle.bundle_type.charAt(0).toUpperCase() + bundle.bundle_type.slice(1)}
                    </span>
                  </div>
                  {!bundle.is_active && (
                    <span className="bg-gray-200 text-gray-700 text-xs px-2 py-1 rounded">Inactive</span>
                  )}
                </div>

                {bundle.description && (
                  <p className="text-sm text-gray-600 mb-4">{bundle.description}</p>
                )}

                <div className="space-y-2 mb-4">
                  <p className="text-sm font-medium text-gray-700">Includes:</p>
                  {bundle.bundle_items?.map((item, index) => (
                    <div key={index} className="text-sm text-gray-600 flex justify-between">
                      <span>• {item.products?.name}</span>
                      <span className="font-medium">×{item.quantity}</span>
                    </div>
                  ))}
                </div>

                <div className="border-t pt-4 space-y-2">
                  {bundle.discount_percentage > 0 && (
                    <div className="flex justify-between text-sm">
                      <span className="text-green-600 font-medium">Discount</span>
                      <span className="text-green-600 font-medium">{bundle.discount_percentage}% OFF</span>
                    </div>
                  )}
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Bundle Price</span>
                    <span className="text-brand-gold">₹{bundleTotal.toFixed(2)}</span>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <button
                    onClick={() => handleEdit(bundle)}
                    className="flex-1 bg-gray-100 text-gray-700 py-2 rounded-lg text-sm font-medium hover:bg-gray-200"
                  >
                    Edit
                  </button>
                  <button
                    onClick={() => handleToggleActive(bundle)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium ${
                      bundle.is_active
                        ? 'bg-yellow-100 text-yellow-700 hover:bg-yellow-200'
                        : 'bg-green-100 text-green-700 hover:bg-green-200'
                    }`}
                  >
                    {bundle.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                  <button
                    onClick={() => handleDelete(bundle.id)}
                    className="px-4 py-2 bg-red-100 text-red-700 rounded-lg text-sm font-medium hover:bg-red-200"
                  >
                    Delete
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {bundles.length === 0 && (
        <div className="text-center py-12">
          <p className="text-gray-500">No bundles created yet. Click "Create Bundle" to get started.</p>
        </div>
      )}

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-white border-b px-6 py-4">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-gray-900">
                  {editingBundle ? 'Edit Bundle' : 'Create New Bundle'}
                </h2>
                <button onClick={() => setShowModal(false)} className="text-gray-400 hover:text-gray-600">
                  ✕
                </button>
              </div>
            </div>

            <div className="p-6 space-y-4">
              {/* Bundle Name */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bundle Name *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  placeholder="e.g., Starter Pack"
                />
              </div>

              {/* Bundle Type */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bundle Type
                </label>
                <select
                  value={formData.bundle_type}
                  onChange={(e) => setFormData({ ...formData, bundle_type: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                >
                  <option value="starter">Starter Pack</option>
                  <option value="weekly">Weekly Pack</option>
                  <option value="promotional">Promotional</option>
                </select>
              </div>

              {/* Description */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                  rows={2}
                  placeholder="Brief description of the bundle"
                />
              </div>

              {/* Discount */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Discount (%)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  step="0.1"
                  value={formData.discount_percentage}
                  onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) || 0 })}
                  className="w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                />
              </div>

              {/* Products in Bundle */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Products in Bundle *
                  </label>
                  <button
                    type="button"
                    onClick={addProductToBundle}
                    className="text-brand-gold text-sm font-medium hover:underline"
                  >
                    + Add Product
                  </button>
                </div>

                <div className="space-y-3">
                  {selectedProducts.map((item, index) => (
                    <div key={index} className="flex gap-2">
                      <select
                        value={item.product_id}
                        onChange={(e) => updateBundleProduct(index, 'product_id', e.target.value)}
                        className="flex-1 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none text-sm"
                      >
                        <option value="">Select Product</option>
                        {products.map(product => (
                          <option key={product.id} value={product.id}>
                            {product.name} - ₹{product.price}/{product.unit}
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateBundleProduct(index, 'quantity', parseInt(e.target.value) || 1)}
                        className="w-20 px-3 py-2 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none text-sm"
                        placeholder="Qty"
                      />
                      <button
                        type="button"
                        onClick={() => removeBundleProduct(index)}
                        className="px-3 py-2 bg-red-100 text-red-700 rounded-lg text-sm hover:bg-red-200"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>

                {selectedProducts.length === 0 && (
                  <p className="text-sm text-gray-500 text-center py-4">No products added yet</p>
                )}
              </div>

              {/* Active Toggle */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <span className="text-sm font-medium text-gray-700">Active</span>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formData.is_active}
                    onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-brand-gold/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-brand-gold"></div>
                </label>
              </div>
            </div>

            {/* Footer */}
            <div className="border-t p-6 bg-gray-50 flex gap-3">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 bg-white border border-gray-300 text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleSave}
                disabled={saving || !formData.name || selectedProducts.length === 0}
                className="flex-1 bg-brand-gold text-brand-black py-3 rounded-lg font-semibold hover:bg-yellow-500 transition disabled:opacity-50"
              >
                {saving ? 'Saving...' : (editingBundle ? 'Update Bundle' : 'Create Bundle')}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
};

export default BundlesPage;