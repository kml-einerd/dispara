import { create } from 'zustand';
import { AffiliateAccount } from '../types';
import { api } from '../lib/api';

interface MarketplacesState {
  shopeeConnected: boolean;
  mlConnected: boolean;
  accounts: AffiliateAccount[];
  loading: boolean;
  loadAccounts: () => Promise<void>;
  disconnect: (id: string) => Promise<void>;
  connectShopee: (appId: string, secret: string) => Promise<void>;
}

export const useMarketplacesStore = create<MarketplacesState>((set, get) => ({
  shopeeConnected: false,
  mlConnected: false,
  accounts: [],
  loading: false,
  loadAccounts: async () => {
    set({ loading: true });
    try {
      const { accounts } = await api.get('/oauth/accounts');
      set({
        accounts,
        shopeeConnected: accounts.some((a: AffiliateAccount) => a.marketplace === 'SHOPEE' && a.status === 'ACTIVE'),
        mlConnected: accounts.some((a: AffiliateAccount) => a.marketplace === 'MERCADOLIVRE' && a.status === 'ACTIVE'),
      });
    } catch (error) {
      console.error('Failed to load affiliate accounts', error);
    } finally {
      set({ loading: false });
    }
  },
  disconnect: async (id: string) => {
    await api.delete(`/oauth/accounts/${id}`);
    await get().loadAccounts();
  },
  connectShopee: async (appId: string, secret: string) => {
    await api.post('/oauth/shopee/connect', { appId, secret });
    await get().loadAccounts();
  },
}));
