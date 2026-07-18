import React, { createContext, useContext, useState, useEffect } from 'react';
import { Product } from '../types';

interface CompareContextType {
  compareProducts: Product[];
  addToCompare: (product: Product) => void;
  removeFromCompare: (productId: string) => void;
  isInCompare: (productId: string) => boolean;
  clearCompare: () => void;
}

const CompareContext = createContext<CompareContextType | undefined>(undefined);

export function CompareProvider({ children }: { children: React.ReactNode }) {
  const [compareProducts, setCompareProducts] = useState<Product[]>([]);

  useEffect(() => {
    const saved = localStorage.getItem('compare_products');
    if (saved) {
      try {
        setCompareProducts(JSON.parse(saved));
      } catch (e) {
        console.error('Failed to load compare products', e);
      }
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('compare_products', JSON.stringify(compareProducts));
  }, [compareProducts]);

  const addToCompare = (product: Product) => {
    setCompareProducts((prev) => {
      if (prev.some((p) => p.id === product.id)) {
        return prev; // Already in compare
      }
      if (prev.length >= 3) {
        // Exceeded maximum 3, remove the oldest one
        return [...prev.slice(1), product];
      }
      return [...prev, product];
    });
  };

  const removeFromCompare = (productId: string) => {
    setCompareProducts((prev) => prev.filter((p) => p.id !== productId));
  };

  const isInCompare = (productId: string) => {
    return compareProducts.some((p) => p.id === productId);
  };

  const clearCompare = () => {
    setCompareProducts([]);
  };

  return (
    <CompareContext.Provider value={{ compareProducts, addToCompare, removeFromCompare, isInCompare, clearCompare }}>
      {children}
    </CompareContext.Provider>
  );
}

export function useCompare() {
  const context = useContext(CompareContext);
  if (context === undefined) {
    throw new Error('useCompare must be used within a CompareProvider');
  }
  return context;
}
