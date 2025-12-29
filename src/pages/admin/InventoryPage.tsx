import { useState, useEffect } from 'react';
import { supabase } from '../../lib/supabase';
import AdminLayout from '../../components/AdminLayout';

interface Product {
  id: string;
  name: string;
  sku: string;
  stock_quantity: number;
  reorder_threshold: number;
  unit: string;
  categories: { name: string };
}

const InventoryPage = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'low'>('all');
  const [editingId, setEditingId] = useState<string | null>(null);
  const [newStock, setNewStock] = useState<number>(0);
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    fetchProducts();
  }, []);

  const fetchProducts = async () => {
    const { data } = await supabase
      .from('products')
      .select('id, name, sku, stock_quantity, reorder_threshold, unit, categories(name)')
      .eq('is_active', true)
      .order('stock_quantity', { ascending: true });

    if (data) setProducts(data as any);
    setLoading(false);
  };

  const updateStock = async (productId: string) => {
    setUpdating(true);

    const { error } = await supabase
      .from('products')
      .update({ stock_quantity: newStock })
      .eq('id', productId);

    if (!error) {
      setProducts(prev =>
        prev.map(p => p.id === productId ? { ...p, stock_quantity: newStock } : p)
      );
      setEditingId(null);
    }

    setUpdating(false);
  };

  const lowStockProducts = products.filter(p => p.stock_quantity <= p.reorder_threshold);
  const displayProducts = filter === 'low' ? lowStockProducts : products;

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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Inventory</h1>
        <p className="text-gray-600 mt-1">Track and manage stock levels</p>
      </div>

      {/* Alert for low stock */}
      {lowStockProducts.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-xl p-4 mb-6 flex items-center gap-3">
          <span className="text-2xl">⚠️</span>
          <div>
            <p className="font-medium text-red-800">Low Stock Alert</p>
            <p className="text-sm text-red-600">{lowStockProducts.length} product(s) below reorder threshold</p>
          </div>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setFilter('all')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'all'
              ? 'bg-brand-black text-white'
              : 'bg-white text-gray-600 hover:bg-gray-100'
          }`}
        >
          All Products ({products.length})
        </button>
        <button
          onClick={() => setFilter('low')}
          className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
            filter === 'low'
              ? 'bg-red-600 text-white'
              : 'bg-white text-red-600 hover:bg-red-50'
          }`}
        >
          Low Stock ({lowStockProducts.length})
        </button>
      </div>

      {/* Inventory Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Product</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Category</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">SKU</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Current Stock</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Reorder At</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Status</th>
                <th className="text-left py-4 px-6 text-sm font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {displayProducts.map(product => {
                const isLowStock = product.stock_quantity <= product.reorder_threshold;
                const isEditing = editingId === product.id;

                return (
                  <tr key={product.id} className={`border-t hover:bg-gray-50 ${isLowStock ? 'bg-red-50' : ''}`}>
                    <td className="py-4 px-6">
                      <p className="font-medium text-gray-900">{product.name}</p>
                    </td>
                    <td className="py-4 px-6 text-gray-600">
                      {product.categories?.name}
                    </td>
                    <td className="py-4 px-6 text-gray-500 text-sm">
                      {product.sku || '-'}
                    </td>
                    <td className="py-4 px-6">
                      {isEditing ? (
                        <input
                          type="number"
                          min="0"
                          value={newStock}
                          onChange={(e) => setNewStock(parseInt(e.target.value) || 0)}
                          className="w-24 px-3 py-1 border rounded-lg focus:ring-2 focus:ring-brand-gold outline-none"
                          autoFocus
                        />
                      ) : (
                        <span className={`font-medium ${isLowStock ? 'text-red-600' : 'text-gray-900'}`}>
                          {product.stock_quantity} {product.unit}
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6 text-gray-500">
                      {product.reorder_threshold} {product.unit}
                    </td>
                    <td className="py-4 px-6">
                      {isLowStock ? (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-red-100 text-red-800">
                          Low Stock
                        </span>
                      ) : (
                        <span className="inline-block px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
                          In Stock
                        </span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      {isEditing ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => updateStock(product.id)}
                            disabled={updating}
                            className="text-green-600 hover:underline text-sm font-medium"
                          >
                            {updating ? '...' : 'Save'}
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="text-gray-500 hover:underline text-sm"
                          >
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => {
                            setEditingId(product.id);
                            setNewStock(product.stock_quantity);
                          }}
                          className="text-brand-gold hover:underline text-sm font-medium"
                        >
                          Update Stock
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {displayProducts.length === 0 && (
          <p className="text-gray-500 text-center py-12">No products found</p>
        )}
      </div>
    </AdminLayout>
  );
};

export default InventoryPage;