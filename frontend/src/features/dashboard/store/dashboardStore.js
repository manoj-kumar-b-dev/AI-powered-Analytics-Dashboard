import { create } from 'zustand';

export const useDashboardStore = create((set, get) => ({
  activeDSId: null,
  dashboard: null,
  filters: {
    date: "",
    department: "",
    region: "",
    product: "",
    category: "",
    salesperson: ""
  },
  isLoading: false,
  error: null,

  setFilter: (key, value) => {
    set((state) => ({
      filters: { ...state.filters, [key]: value }
    }));
    get().fetchDashboard();
  },

  clearFilters: () => {
    set({
      filters: {
        date: "",
        department: "",
        region: "",
        product: "",
        category: "",
        salesperson: ""
      }
    });
    get().fetchDashboard();
  },

  fetchDashboard: async () => {
    set({ isLoading: true, error: null });
    const { filters } = get();
    const token = localStorage.getItem('token');
    
    const queryParams = new URLSearchParams();
    Object.keys(filters).forEach(key => {
      const val = filters[key];
      if (val !== undefined && val !== null && val !== "") {
        queryParams.append(key, val);
      }
    });

    try {
      const res = await fetch(`http://localhost:5000/dashboard?${queryParams.toString()}`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!res.ok) {
        throw new Error('Failed to fetch dashboard analytics');
      }

      const data = await res.json();
      set({
        dashboard: data,
        activeDSId: data.dataSourceId || null,
        isLoading: false
      });
    } catch (err) {
      console.error(err);
      set({ error: err.message, isLoading: false });
    }
  },

  invalidateAndReload: async () => {
    set({ dashboard: null, activeDSId: null });
    await get().fetchDashboard();
  }
}));
