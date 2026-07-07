import { useState, useCallback } from 'react';
import { useDashboardStore } from '../store/dashboardStore';

export const useFilters = () => {
  const { filters, setFilter, clearFilters } = useDashboardStore();
  const [isLoadingFilters, setIsLoadingFilters] = useState(false);

  const handleFilterChange = useCallback((field, value) => {
    setIsLoadingFilters(true);
    setFilter(field, value);
    setTimeout(() => {
      setIsLoadingFilters(false);
    }, 600);
  }, [setFilter]);

  const handleClearFilters = useCallback(() => {
    setIsLoadingFilters(true);
    clearFilters();
    setTimeout(() => {
      setIsLoadingFilters(false);
    }, 500);
  }, [clearFilters]);

  const isAnyFilterActive = Object.values(filters).some((v) => v !== "");

  return {
    filters,
    isLoadingFilters,
    isAnyFilterActive,
    handleFilterChange,
    handleClearFilters
  };
};
