import { useState, useEffect } from 'react';
import { useApp } from '../context/AppContext';
import { supabase } from '../lib/supabase';
import Header from '../components/Header';
import ReorderSuggestions from '../components/ReorderSuggestions';

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
  const [catRes, prodRes, bundlesRes] = await Promise.all([
    supabase.from('categories').select('*').eq('is_active', true).order('sort_order'),
    supabase.from('products').select('*, categories(name)').eq('is_active', true).order('sort_order'),
    supabase.from('product_bundles').select(`
      *,
      bundle_items(
        product_id,
        quantity,
        products(id, name, price, unit, gst_rate, image_url)
      )
    `).eq('is_active', true).order('sort_order')
  ]);

  if (catRes.data) setCategories(catRes.data);
  if (prodRes.data) setProducts(prodRes.data);
  if (bundlesRes.data) setBundles(bundlesRes.data);
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
  
const handleAddBundleToCart = (bundle: Bundle) => {
  bundle.bundle_items?.forEach(item => {
    if (item.products) {
      addToCart(item.products, item.quantity);
    }
  });
  alert(`✅ ${bundle.name} added to cart!`);
};

const calculateBundleTotal = (bundle: Bundle) => {
  const subtotal = bundle.bundle_items?.reduce((sum, item) => {
    return sum + (item.products ? item.products.price * item.quantity : 0);
  }, 0) || 0;
  
  const discount = (subtotal * bundle.discount_percentage) / 100;
  return subtotal - discount;
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
{/* Product Bundles Section */}
      {bundles.length > 0 && (
        <div className="mb-12">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h2 className="font-display text-2xl font-semibold text-brand-black">
                🎁 Special Bundles
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Save with our curated product bundles
              </p>
            </div>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-8">
            {bundles.map(bundle => {
              const bundleTotal = calculateBundleTotal(bundle);
              const originalTotal = bundle.bundle_items?.reduce((sum, item) => {
                return sum + (item.products ? item.products.price * item.quantity : 0);
              }, 0) || 0;

              return (
                <div key={bundle.id} className="bg-white rounded-xl shadow-lg overflow-hidden border-2 border-brand-gold/20 hover:border-brand-gold transition">
                  {/* Bundle Header */}
                  <div className="bg-gradient-to-r from-brand-gold to-yellow-500 p-4">
                    <div className="flex items-center justify-between">
                      <span className={`px-3 py-1 rounded-full text-xs font-bold text-white ${
                        bundle.bundle_type === 'starter' ? 'bg-blue-600' :
                        bundle.bundle_type === 'weekly' ? 'bg-green-600' :
                        'bg-purple-600'
                      }`}>
                        {bundle.bundle_type === 'starter' ? '⭐ STARTER PACK' :
                         bundle.bundle_type === 'weekly' ? '📦 WEEKLY PACK' :
                         '🎉 SPECIAL OFFER'}
                      </span>
                      {bundle.discount_percentage > 0 && (
                        <span className="bg-red-600 text-white px-3 py-1 rounded-full text-xs font-bold">
                          {bundle.discount_percentage}% OFF
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Bundle Content */}
                  <div className="p-6">
                    <h3 className="font-display text-xl font-semibold text-brand-black mb-2">
                      {bundle.name}
                    </h3>
                    {bundle.description && (
                      <p className="text-sm text-gray-600 mb-4">{bundle.description}</p>
                    )}

                    {/* Bundle Items */}
                    <div className="space-y-2 mb-4">
                      <p className="text-xs font-semibold text-gray-700 uppercase">Includes:</p>
                      {bundle.bundle_items?.map((item, index) => (
                        <div key={index} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2">
                            <span className="text-brand-gold">✓</span>
                            <span className="text-gray-700">{item.products?.name}</span>
                          </div>
                          <span className="font-medium text-gray-900">×{item.quantity}</span>
                        </div>
                      ))}
                    </div>

                    {/* Pricing */}
                    <div className="border-t pt-4 space-y-2">
                      {bundle.discount_percentage > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-gray-500 line-through">Original Price</span>
                          <span className="text-gray-500 line-through">₹{originalTotal.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-lg font-semibold text-gray-900">Bundle Price</span>
                        <span className="text-2xl font-bold text-brand-gold">
                          ₹{bundleTotal.toFixed(2)}
                        </span>
                      </div>
                      {bundle.discount_percentage > 0 && (
                        <p className="text-xs text-green-600 font-medium">
                          You save ₹{(originalTotal - bundleTotal).toFixed(2)}
                        </p>
                      )}
                    </div>

                    {/* Add to Cart Button */}
                    <button
                      onClick={() => handleAddBundleToCart(bundle)}
                      className="w-full mt-4 bg-brand-gold text-brand-black py-3 rounded-lg font-bold hover:bg-yellow-500 transition transform hover:scale-105"
                    >
                      🛒 Add Bundle to Cart
                    </button>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Separator */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center">
              <span className="bg-brand-cream px-4 text-sm text-gray-500 font-medium">
                OR SHOP INDIVIDUAL PRODUCTS BELOW
              </span>
            </div>
          </div>
        </div>
      )}

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
{/* Reorder Suggestions */}
        {franchise && (
          <ReorderSuggestions franchiseId={franchise.id} />
        )}
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