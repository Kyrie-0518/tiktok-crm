import { create } from 'zustand';
import api from '../api';

export interface Influencer {
  id?: number;
  shop_id?: number | null;
  influencer_id: string;
  profile_url: string;
  contact_channel: string;
  contact_info: string;
  cooperation_type: string;
  commission_rate: number;
  product_id?: number | null;
  sample_qty: number;
  sample_cost: number;
  send_date: string;
  receive_date: string;
  material_schedule: string;
  material_url: string;
  remark: string;
  // Joined fields
  shop_name?: string;
  product_name?: string;
  product_cost_price?: number;
  created_at?: string;
}

interface InfluencerState {
  influencers: Influencer[];
  total: number;
  loading: boolean;
  page: number;
  pageSize: number;
  fetchInfluencers: (params?: {
    keyword?: string;
    status?: string;
    cooperation_type?: string;
    shop_id?: number | null;
    send_date_from?: string;
    send_date_to?: string;
    receive_from?: string;
    receive_to?: string;
    contact_date_from?: string;
    contact_date_to?: string;
    page?: number;
  }) => Promise<void>;
  createInfluencer: (data: any) => Promise<any>;
  updateInfluencer: (id: number, data: any) => Promise<any>;
  deleteInfluencer: (id: number) => Promise<void>;
  setPage: (page: number) => void;
}

export const useInfluencerStore = create<InfluencerState>((set, get) => ({
  influencers: [],
  total: 0,
  loading: false,
  page: 1,
  pageSize: 20,

  fetchInfluencers: async (params = {}) => {
    set({ loading: true });
    try {
      const { data } = await api.get('/influencers', {
        params: {
          keyword: params.keyword || undefined,
          status: params.status || undefined,
          cooperation_type: params.cooperation_type || undefined,
          shop_id: params.shop_id || undefined,
          send_date_from: params.send_date_from || undefined,
          send_date_to: params.send_date_to || undefined,
          receive_from: params.receive_from || undefined,
          receive_to: params.receive_to || undefined,
          contact_date_from: params.contact_date_from || undefined,
          contact_date_to: params.contact_date_to || undefined,
          page: params.page || get().page,
          page_size: get().pageSize,
        }
      });
      set({ influencers: data.list || [], total: data.total || 0, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  createInfluencer: async (formData: any) => {
    const { data } = await api.post('/influencers', formData);
    get().fetchInfluencers({ page: 1 });
    return data;
  },

  updateInfluencer: async (id: number, formData: any) => {
    const { data } = await api.put(`/influencers/${id}`, formData);
    get().fetchInfluencers();
    return data;
  },

  deleteInfluencer: async (id: number) => {
    await api.delete(`/influencers/${id}`);
    get().fetchInfluencers();
  },

  setPage: (page: number) => set({ page }),
}));
