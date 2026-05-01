import { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { supabase } from './lib/supabase';
import { User } from '@supabase/supabase-js';

// Types
interface Franchise {
  id: string;
  auth_user_id: string;
  franchise_name: string;
  owner_name: string;
  email: string;
  phone: string;
  site_location: string;
  full_address: string;
  city: string;
  state: string;
  pincode: string;
  omc_partner: string;
  status: 'pending' | 'approved' | 'rejected' | 'suspended';
  rejection_reason?: string;
  created_at: string;
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
  gst_rate: number;
  hsn_code: string;
  is_active: boolean;
  categories?: { name: string };
}

interface CartItem {
  product: Product;
  quantity: number;
}

interface AppContextType {
  user: User | null;
  franchise: Franchise | null;
  isAdmin: boolean;
  adminChecked: boolean;
  cart: CartItem[];
  cartTotal: number;
  cartCount: number;
  loading: boolean;
  addToCart: (product: Product, quantity?: number) => void;
  updateCartQuantity: (productId: string, quantity: number) => void;
  removeFromCart: (productId: string) => void;
  clearCart: () => void;
  signOut: () => Promise<void>;
  refreshFranchise: () => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) {
    throw new Error('useApp must be used within AppProvider');
  }
  return context;
};

export const AppProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [franchise, setFranchise] = useState<Franchise | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminChecked, setAdminChecked] = useState(false);
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const initializedRef = useRef(false);

  useEffect(() => {
    // Prevent double-init in React 18 StrictMode
    if (initializedRef.current) return;
    initializedRef.current = true;

    // Safety timeout — if loading is STILL true after 8 seconds, force it off.
    // This catches any edge case where Supabase hangs, network fails, etc.
    const timeout = setTimeout(() => {
      setLoading(false);
      setAdminChecked(true);
    }, 8000);

    const initialize = async () => {
      try {
        const { data: { session }, error } = await supabase.auth.getSession();

        if (error) {
          console.error('getSession error:', error);
          setLoading(false);
          setAdminChecked(true);
          return;
        }

        if (session?.user) {
          setUser(session.user);
          await Promise.all([
            fetchFranchise(session.user.id),
            checkAdmin(session.user.id),
          ]);
        } else {
          setLoading(false);
          setAdminChecked(true);
        }
      } catch (err) {
        console.error('Auth initialization failed:', err);
        setLoading(false);
        setAdminChecked(true);
      }
    };

    initialize();

    // Listen for auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          setUser(session.user);
          await Promise.all([
            fetchFranchise(session.user.id),
            checkAdmin(session.user.id),
          ]);
        } else {
          setUser(null);
          setFranchise(null);
          setIsAdmin(false);
          setAdminChecked(true);
          setLoading(false);
        }
      }
    );

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, []);

  const checkAdmin = async (authUserId: string) => {
    try {
      const { data: adminData } = await supabase
        .from('admin_users')
        .select('id')
        .eq('auth_user_id', authUserId)
        .maybeSingle();
      setIsAdmin(!!adminData);
    } catch (err) {
      console.error('checkAdmin error:', err);
      setIsAdmin(false);
    }
    setAdminChecked(true);
  };

  const fetchFranchise = async (authUserId: string) => {
    try {
      const { data, error } = await supabase
        .from('franchises')
        .select('*')
        .eq('auth_user_id', authUserId)
        .maybeSingle();

      if (error) {
        console.error('fetchFranchise error:', error);
      }

      setFranchise(data ?? null);
    } catch (err) {
      console.error('fetchFranchise failed:', err);
      setFranchise(null);
    }
    setLoading(false);
  };

  const addToCart = (product: Product, quantity = 1) => {
    setCart(prev => {
      const existing = prev.find(item => item.product.id === product.id);
      if (existing) {
        return prev.map(item =>
          item.product.id === product.id
            ? { ...item, quantity: item.quantity + quantity }
            : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const updateCartQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeFromCart(productId);
      return;
    }
    setCart(prev =>
      prev.map(item =>
        item.product.id === productId
          ? { ...item, quantity }
          : item
      )
    );
  };

  const removeFromCart = (productId: string) => {
    setCart(prev => prev.filter(item => item.product.id !== productId));
  };

  const clearCart = () => setCart([]);

  const cartTotal = cart.reduce((sum, item) => sum + (item.product.price * item.quantity), 0);
  const cartCount = cart.reduce((sum, item) => sum + item.quantity, 0);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setFranchise(null);
    setCart([]);
    setIsAdmin(false);
    setAdminChecked(false);
  };

  return (
    <AppContext.Provider value={{
      user,
      franchise,
      isAdmin,
      adminChecked,
      cart,
      cartTotal,
      cartCount,
      loading,
      addToCart,
      updateCartQuantity,
      removeFromCart,
      clearCart,
      signOut,
      refreshFranchise: () => user && fetchFranchise(user.id)
    }}>
      {children}
    </AppContext.Provider>
  );
};
