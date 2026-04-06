import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useApp } from '../context/AppContext';
import {
  RefreshCw,
  ShoppingCart,
  Clock,
  TrendingUp,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Plus,
  Check,
} from 'lucide-react';

// ─── Types ───────────────────────────────────────────────────
interface OrderHistoryItem {
  product_id: string;
  product_name: string;
  quantity: number;
  unit_price: number;
  order_date: string;
}

interface ReorderSuggestion {
  product_id: string;
  product_name: string;
  image_url: string;
  category_name: string;
  unit: string;
  current_price: number;
  times_ordered: number;
  avg_quantity: number;
  suggested_quantity: number;
  avg_days_between_orders: number;
  days_since_last_order: number;
  last_order_date: string;
  urgency: 'overdue' | 'due_soon' | 'regular';
  urgency_score: number; // higher = more urgent
  is_active: boolean;
}

interface ReorderSuggestionsProps {
  franchiseId: string;
}

// ─── Component ───────────────────────────────────────────────
const ReorderSuggestions = ({ franchiseId }: ReorderSuggestionsProps) => {
  const { addToCart } = useApp();
  const [suggestions, setSuggestions] = useState<ReorderSuggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(true);
  const [addedItems, setAddedItems] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (franchiseId) {
      analyzePurchaseHistory();
    }
  }, [franchiseId]);

  const analyzePurchaseHistory = async () => {
    setLoading(true);

    try {
      // 1. Fetch all delivered/completed orders for this franchise with items
      const { data: orders } = await supabase
        .from('orders')
        .select('id, created_at, status, order_items(product_id, product_name, quantity, unit_price)')
        .eq('franchise_id', franchiseId)
        .in('status', ['delivered', 'confirmed', 'processing', 'shipped', 'pending'])
        .neq('status', 'cancelled')
        .order('created_at', { ascending: true });

      if (!orders || orders.length === 0) {
        setSuggestions([]);
        setLoading(false);
        return;
      }

      // 2. Flatten into order history items
      const historyItems: OrderHistoryItem[] = [];
      orders.forEach((order: any) => {
        order.order_items?.forEach((item: any) => {
          historyItems.push({
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            unit_price: item.unit_price,
            order_date: order.created_at,
          });
        });
      });

      // 3. Group by product
      const productMap = new Map<string, OrderHistoryItem[]>();
      historyItems.forEach(item => {
        const existing = productMap.get(item.product_id) || [];
        existing.push(item);
        productMap.set(item.product_id, existing);
      });

      // 4. Fetch current product details for all ordered products
      const productIds = Array.from(productMap.keys());
      const { data: products } = await supabase
        .from('products')
        .select('id, name, price, unit, image_url, is_active, categories(name)')
        .in('id', productIds);

      const productDetailsMap = new Map<string, any>();
      products?.forEach(p => productDetailsMap.set(p.id, p));

      // 5. Calculate suggestions
      const now = Date.now();
      const rawSuggestions: ReorderSuggestion[] = [];

      productMap.forEach((items, productId) => {
        // Need at least 1 order to suggest
        if (items.length === 0) return;

        const product = productDetailsMap.get(productId);
        if (!product) return;

        // Sort by date ascending
        const sorted = items.sort(
          (a, b) => new Date(a.order_date).getTime() - new Date(b.order_date).getTime()
        );

        // Calculate average quantity
        const totalQty = sorted.reduce((sum, item) => sum + item.quantity, 0);
        const avgQty = totalQty / sorted.length;

        // Calculate average days between orders
        let avgDaysBetween = 30; // default assumption for single-order products
        if (sorted.length >= 2) {
          const gaps: number[] = [];
          for (let i = 1; i < sorted.length; i++) {
            const gap =
              (new Date(sorted[i].order_date).getTime() -
                new Date(sorted[i - 1].order_date).getTime()) /
              (1000 * 60 * 60 * 24);
            gaps.push(gap);
          }
          avgDaysBetween = gaps.reduce((sum, g) => sum + g, 0) / gaps.length;
        }

        // Days since last order
        const lastOrderDate = sorted[sorted.length - 1].order_date;
        const daysSinceLast = Math.floor(
          (now - new Date(lastOrderDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Determine urgency
        let urgency: ReorderSuggestion['urgency'] = 'regular';
        let urgencyScore = 0;

        if (sorted.length >= 2) {
          // Multi-order products: compare against pattern
          const ratio = daysSinceLast / Math.max(avgDaysBetween, 1);
          if (ratio >= 1.2) {
            urgency = 'overdue';
            urgencyScore = ratio * 100;
          } else if (ratio >= 0.7) {
            urgency = 'due_soon';
            urgencyScore = ratio * 50;
          } else {
            urgencyScore = ratio * 20;
          }
        } else {
          // Single-order products: suggest after 14+ days
          if (daysSinceLast >= 30) {
            urgency = 'overdue';
            urgencyScore = daysSinceLast * 2;
          } else if (daysSinceLast >= 14) {
            urgency = 'due_soon';
            urgencyScore = daysSinceLast;
          } else {
            urgencyScore = daysSinceLast * 0.5;
          }
        }

        // Suggested quantity: round up to nearest whole, minimum the avg
        const suggestedQty = Math.max(1, Math.round(avgQty));

        rawSuggestions.push({
          product_id: productId,
          product_name: product.name,
          image_url: product.image_url || '',
          category_name: product.categories?.name || '',
          unit: product.unit,
          current_price: product.price,
          times_ordered: sorted.length,
          avg_quantity: avgQty,
          suggested_quantity: suggestedQty,
          avg_days_between_orders: Math.round(avgDaysBetween),
          days_since_last_order: daysSinceLast,
          last_order_date: lastOrderDate,
          urgency,
          urgency_score: urgencyScore,
          is_active: product.is_active,
        });
      });

      // 6. Filter & sort: only show overdue or due_soon, sorted by urgency
      const filtered = rawSuggestions
        .filter(s => s.is_active && (s.urgency === 'overdue' || s.urgency === 'due_soon'))
        .sort((a, b) => b.urgency_score - a.urgency_score);

      setSuggestions(filtered);
    } catch (err) {
      console.error('Error analyzing purchase history:', err);
    }

    setLoading(false);
  };

  const handleAddToCart = (suggestion: ReorderSuggestion) => {
    // Create a minimal product object compatible with addToCart
    const product = {
      id: suggestion.product_id,
      name: suggestion.product_name,
      price: suggestion.current_price,
      unit: suggestion.unit,
      image_url: suggestion.image_url,
      // Fill required fields from Product interface
      category_id: '',
      description: '',
      sku: '',
      stock_quantity: 999,
      reorder_threshold: 0,
      is_active: true,
      min_order_qty: 1,
    };

    addToCart(product, suggestion.suggested_quantity);

    // Show added feedback
    setAddedItems(prev => new Set(prev).add(suggestion.product_id));
    setTimeout(() => {
      setAddedItems(prev => {
        const next = new Set(prev);
        next.delete(suggestion.product_id);
        return next;
      });
    }, 2000);
  };

  const handleAddAllToCart = () => {
    suggestions.forEach(s => {
      if (!addedItems.has(s.product_id)) {
        handleAddToCart(s);
      }
    });
  };

  // ─── Don't render if no suggestions ────────────────────────
  if (!loading && suggestions.length === 0) return null;

  const overdueCount = suggestions.filter(s => s.urgency === 'overdue').length;
  const dueSoonCount = suggestions.filter(s => s.urgency === 'due_soon').length;

  return (
    <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8 border border-amber-100">
      {/* Header Bar */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-amber-50 to-orange-50 hover:from-amber-100 hover:to-orange-100 transition"
      >
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-lg bg-brand-gold flex items-center justify-center">
            <Sparkles size={18} className="text-brand-black" />
          </div>
          <div className="text-left">
            <h2 className="text-base font-bold text-gray-900">Reorder Suggestions</h2>
            <p className="text-xs text-gray-500 mt-0.5">
              {loading ? 'Analyzing your order history...' : (
                <>
                  {overdueCount > 0 && (
                    <span className="text-red-600 font-medium">{overdueCount} overdue</span>
                  )}
                  {overdueCount > 0 && dueSoonCount > 0 && ' · '}
                  {dueSoonCount > 0 && (
                    <span className="text-amber-600 font-medium">{dueSoonCount} due soon</span>
                  )}
                  {' · based on your ordering patterns'}
                </>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {!loading && expanded && suggestions.length > 1 && (
            <span
              onClick={(e) => { e.stopPropagation(); handleAddAllToCart(); }}
              className="hidden sm:inline-flex items-center gap-1 px-3 py-1.5 bg-brand-black text-white text-xs font-medium rounded-lg hover:bg-gray-800 transition cursor-pointer"
            >
              <ShoppingCart size={13} />
              Add All to Cart
            </span>
          )}
          {expanded ? <ChevronUp size={18} className="text-gray-400" /> : <ChevronDown size={18} className="text-gray-400" />}
        </div>
      </button>

      {/* Suggestions List */}
      {expanded && (
        <div className="px-5 py-4">
          {loading ? (
            <div className="flex items-center justify-center py-6 gap-2 text-gray-400">
              <RefreshCw size={16} className="animate-spin" />
              <span className="text-sm">Analyzing your purchase patterns...</span>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
              {suggestions.map(s => (
                <div
                  key={s.product_id}
                  className={`relative rounded-lg border p-3 transition hover:shadow-md ${
                    s.urgency === 'overdue'
                      ? 'border-red-200 bg-red-50/40'
                      : 'border-amber-200 bg-amber-50/40'
                  }`}
                >
                  {/* Urgency Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${
                        s.urgency === 'overdue'
                          ? 'bg-red-100 text-red-700'
                          : 'bg-amber-100 text-amber-700'
                      }`}
                    >
                      <Clock size={11} />
                      {s.urgency === 'overdue' ? 'Overdue' : 'Due Soon'}
                    </span>
                    <span className="text-xs text-gray-400">{s.category_name}</span>
                  </div>

                  {/* Product Info */}
                  <div className="flex gap-2 mb-2">
                    <div className="w-10 h-10 rounded-md bg-gray-100 flex items-center justify-center flex-shrink-0 overflow-hidden">
                      {s.image_url ? (
                        <img src={s.image_url} alt={s.product_name} className="w-full h-full object-cover" />
                      ) : (
                        <span className="text-lg opacity-30">📦</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate">{s.product_name}</p>
                      <p className="text-xs text-gray-500">₹{s.current_price}/{s.unit}</p>
                    </div>
                  </div>

                  {/* Pattern Info */}
                  <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-gray-500 mb-3">
                    <span className="flex items-center gap-1">
                      <TrendingUp size={11} />
                      Ordered {s.times_ordered}x
                    </span>
                    <span>
                      Every ~{s.avg_days_between_orders}d
                    </span>
                    <span className={`font-medium ${s.urgency === 'overdue' ? 'text-red-600' : 'text-amber-600'}`}>
                      Last: {s.days_since_last_order}d ago
                    </span>
                  </div>

                  {/* Add to Cart */}
                  <button
                    onClick={() => handleAddToCart(s)}
                    disabled={addedItems.has(s.product_id)}
                    className={`w-full flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-medium transition ${
                      addedItems.has(s.product_id)
                        ? 'bg-green-100 text-green-700 cursor-default'
                        : 'bg-brand-gold text-brand-black hover:bg-brand-gold-light'
                    }`}
                  >
                    {addedItems.has(s.product_id) ? (
                      <>
                        <Check size={14} />
                        Added!
                      </>
                    ) : (
                      <>
                        <Plus size={14} />
                        Add {s.suggested_quantity} {s.unit}
                      </>
                    )}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ReorderSuggestions;