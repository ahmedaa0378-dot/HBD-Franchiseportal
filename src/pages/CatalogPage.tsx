import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';

interface Category {
  id: string;
  name: string;
  sort_order: number;
}

interface Product {
  id: string;
  category_id: string;
  name: string;
  description: string;
  sku: string;
  price: number;
  unit: string;
  image_url: string;
  stock_quantity: number;
  reorder_threshold: number;
  categories?: { name: string };
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
  bundle_items?: BundleItem[];
}
const CatalogPage = () => {
  const { addToCart } = useApp();
  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [quantities, setQuantities] = useState<Record<string, number>>({});
  const [bundles, setBundles] = useState<Bundle[]>([]);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    const [catRes, prodRes] = await Promise.all([
      supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
      supabase.from('products').select('*, categories(name)').eq('is_active', true).order('sort_order')
    ]);

    if (catRes.data) setCategories(catRes.data);
    if (prodRes.data) setProducts(prodRes.data);
    setLoading(false);
  };

  const filteredProducts = selectedCategory 
    ? products.filter(p => p.category_id === selectedCategory)
    : products;

  const handleQuantityChange = (productId: string, value: number) => {
    setQuantities(prev => ({...prev, [productId]: Math.max(1, value || 1)}));
  };

  const handleAddToCart = (product: Product) => {
    const qty = quantities[product.id] || 1;
    addToCart(product, qty);
    setQuantities(prev => ({...prev, [product.id]: 1}));
  };

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
        <h1 className="font-display text-3xl font-semibold text-brand-black mb-2">Order Supplies</h1>
        <p className="text-gray-600 mb-8">Raw materials delivered to your doorstep</p>

        {/* Category Filter */}
        <div className="flex flex-wrap gap-3 mb-8">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`px-4 py-2 rounded-full text-sm font-medium transition ${
              !selectedCategory 
                ? 'bg-brand-black text-white' 
                : 'bg-white text-gray-700 hover:bg-gray-100'
            }`}
          >
            All Products
          </button>
          {categories.map(cat => (
            <button
              key={cat.id}
              onClick={() => setSelectedCategory(cat.id)}
              className={`px-4 py-2 rounded-full text-sm font-medium transition ${
                selectedCategory === cat.id 
                  ? 'bg-brand-black text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-100'
              }`}
            >
              {cat.name}
            </button>
          ))}
        </div>

        {/* Products Grid */}
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {filteredProducts.map(product => (
            <div key={product.id} className="bg-white rounded-xl shadow-md overflow-hidden hover:shadow-lg transition">
              <div className="h-40 bg-brand-cream flex items-center justify-center">
                {product.image_url ? (
                  <img src={product.image_url} alt={product.name} className="h-full w-full object-cover" />
                ) : (
                  <span className="text-5xl opacity-30">📦</span>
                )}
              </div>
              <div className="p-4">
                <p className="text-xs text-brand-gold font-medium mb-1">{product.categories?.name}</p>
                <h3 className="font-semibold text-brand-black mb-1">{product.name}</h3>
                <p className="text-xs text-gray-500 mb-3 line-clamp-2">{product.description}</p>
                
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <span className="text-xl font-bold text-brand-black">₹{product.price}</span>
                    <span className="text-xs text-gray-500 ml-1">/{product.unit}</span>
                  </div>
                  {product.stock_quantity <= product.reorder_threshold && (
                    <span className="text-xs text-orange-600 bg-orange-50 px-2 py-1 rounded">Low Stock</span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <div className="flex items-center border rounded-lg">
                    <button 
                      onClick={() => handleQuantityChange(product.id, (quantities[product.id] || 1) - 1)}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      -
                    </button>
                    <input
                      type="number"
                      min="1"
                      value={quantities[product.id] || 1}
                      onChange={(e) => handleQuantityChange(product.id, parseInt(e.target.value))}
                      className="w-12 text-center border-x py-2 outline-none"
                    />
                    <button 
                      onClick={() => handleQuantityChange(product.id, (quantities[product.id] || 1) + 1)}
                      className="px-3 py-2 text-gray-600 hover:bg-gray-100"
                    >
                      +
                    </button>
                  </div>
                  <button
                    onClick={() => handleAddToCart(product)}
                    className="flex-1 bg-brand-gold text-brand-black py-2 rounded-lg font-medium hover:bg-brand-gold-light transition"
                  >
                    Add
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredProducts.length === 0 && (
          <div className="text-center py-12">
            <p className="text-gray-500">No products found in this category.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CatalogPage;