import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';
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
  const [cart, setCart] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFranchise(session.user.id);
      } else {
        setLoading(false);
      }
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      if (session?.user) {
        fetchFranchise(session.user.id);
      } else {
        setFranchise(null);
        setLoading(false);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const fetchFranchise = async (authUserId: string) => {
    const { data } = await supabase
      .from('franchises')
      .select('*')
      .eq('auth_user_id', authUserId)
      .single();
    
    if (data) {
      setFranchise(data);
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
  };

  return (
    <AppContext.Provider value={{
      user,
      franchise,
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