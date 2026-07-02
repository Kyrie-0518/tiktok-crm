import { create } from 'zustand';
import api from '../api';

export interface Supplier {
  id: number;
  name: string;
  contact: string;
  created_at: string;
}

export interface Shop {
  id: number;
  name: string;
  created_at: string;
}

/** @deprecated Use ProductSku instead. Kept for legacy product_specs compatibility. */
export interface ProductSpec {
  id?: number;
  spec_name: string;
  batch_no: string;
  cost_price: number;
  stock: number;
}

export interface ProductSku {
  id?: number;
  sku_code: string;
  spec_name: string;
  cost_price: number;
  sell_price: number;
  stock: number;
  image: string;
}

export interface ProductShop {
  id?: number;
  shop_name: string;
  shop_price: number;
}

export interface Product {
  id?: number;
  sku: string;
  name: string;
  image: string;
  weight: number;
  stock: number;
  sell_price: number;
  cost_price: number;
  supplier_id: number | null;
  supplier_name?: string;
  /** @deprecated Use skus instead. */
  specs: ProductSpec[];
  skus: ProductSku[];
  shops: ProductShop[];
  box_qty: number;
  box_length: number;
  box_width: number;
  box_height: number;
  box_remark: string;
  commission: number;
  created_at?: string;
}

interface ProductState {
  products: Product[];
  suppliers: Supplier[];
  shopList: string[];
  loading: boolean;
  fetchProducts: (keyword?: string, shopName?: string) => Promise<void>;
  fetchSuppliers: () => Promise<void>;
  fetchShops: () => Promise<void>;
  fetchProduct: (id: number) => Promise<Product>;
  createProduct: (data: any) => Promise<void>;
  updateProduct: (id: number, data: any) => Promise<void>;
  deleteProduct: (id: number) => Promise<void>;
  updateProductSkus: (id: number, skus: ProductSku[]) => Promise<void>;
  updateProductShops: (id: number, shops: ProductShop[]) => Promise<void>;
  createSupplier: (data: any) => Promise<void>;
  updateSupplier: (id: number, data: any) => Promise<void>;
  deleteSupplier: (id: number) => Promise<void>;
}

export const useProductStore = create<ProductState>((set, get) => ({
  products: [],
  suppliers: [],
  shopList: [],
  loading: false,

  fetchProducts: async (keyword?: string, shopName?: string) => {
    set({ loading: true });
    const params: any = {};
    if (keyword) params.keyword = keyword;
    if (shopName) params.shop_name = shopName;
    const { data } = await api.get('/products', { params });
    set({ products: data, loading: false });
  },

  fetchSuppliers: async () => {
    const { data } = await api.get('/products/suppliers');
    set({ suppliers: data });
  },

  fetchShops: async () => {
    const { data } = await api.get('/shops');
    set({ shopList: data.map((s: any) => s.name) });
  },

  fetchProduct: async (id: number) => {
    const { data } = await api.get(`/products/${id}`);
    return data as Product;
  },

  createProduct: async (formData: any) => {
    await api.post('/products', formData);
    get().fetchProducts();
  },

  updateProduct: async (id: number, formData: any) => {
    await api.put(`/products/${id}`, formData);
    get().fetchProducts();
  },

  deleteProduct: async (id: number) => {
    await api.delete(`/products/${id}`);
    get().fetchProducts();
  },

  updateProductSkus: async (id: number, skus: ProductSku[]) => {
    await api.put(`/products/${id}/skus`, { skus });
    get().fetchProducts();
  },

  updateProductShops: async (id: number, shops: ProductShop[]) => {
    await api.put(`/products/${id}/shops`, { shops });
    get().fetchProducts();
  },

  createSupplier: async (formData: any) => {
    await api.post('/products/suppliers', formData);
    get().fetchSuppliers();
  },

  updateSupplier: async (id: number, formData: any) => {
    await api.put(`/products/suppliers/${id}`, formData);
    get().fetchSuppliers();
  },

  deleteSupplier: async (id: number) => {
    await api.delete(`/products/suppliers/${id}`);
    get().fetchSuppliers();
  },

}));
