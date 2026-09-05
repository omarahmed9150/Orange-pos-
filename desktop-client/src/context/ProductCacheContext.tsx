import { createContext, useContext, ReactNode, useEffect, useState, useCallback } from 'react';

interface ProductCacheContextValue {
  invalidateProducts: () => void;
  queryClient: {
    invalidateQueries: (options: { queryKey: string[] }) => void;
  };
  lastUpdate: number;
}

const ProductCacheContext = createContext<ProductCacheContextValue | null>(null);

const PRODUCT_CACHE_EVENT = 'product-cache-invalidated';

export function ProductCacheProvider({ children }: { children: ReactNode }) {
  const [lastUpdate, setLastUpdate] = useState(0);

  const invalidateProducts = useCallback(() => {
    setLastUpdate(Date.now());
    // Broadcast to other tabs/windows
    localStorage.setItem(PRODUCT_CACHE_EVENT, Date.now().toString());
  }, []);

  const queryClient = {
    invalidateQueries: ({ queryKey }: { queryKey: string[] }) => {
      if (queryKey[0] === 'products') invalidateProducts();
    },
  };

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === PRODUCT_CACHE_EVENT && event.newValue) {
        setLastUpdate(Number(event.newValue));
      }
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  return (
    <ProductCacheContext.Provider value={{ invalidateProducts, queryClient, lastUpdate }}>
      {children}
    </ProductCacheContext.Provider>
  );
}

export function useProductCache() {
  const ctx = useContext(ProductCacheContext);
  if (!ctx) throw new Error('useProductCache must be used within ProductCacheProvider');
  return ctx;
}
