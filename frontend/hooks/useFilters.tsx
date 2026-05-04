'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';

type FilterContextType = {
  selectedBranchId: number | null;
  selectedDepartmentId: number | null;
  setBranch: (id: number | null) => void;
  setDepartment: (id: number | null) => void;
  clearFilters: () => void;
  clearDepartment: () => void;
};

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: React.ReactNode }) {
  const [selectedBranchId, setSelectedBranchId] = useState<number | null>(null);
  const [selectedDepartmentId, setSelectedDepartmentId] = useState<number | null>(null);

  // Initialize from localStorage on mount
  useEffect(() => {
    const savedBranch = localStorage.getItem('selectedBranchId');
    const savedDept = localStorage.getItem('selectedDepartmentId');
    
    if (savedBranch && savedBranch !== 'null') setSelectedBranchId(parseInt(savedBranch));
    if (savedDept && savedDept !== 'null') setSelectedDepartmentId(parseInt(savedDept));
  }, []);

  const setBranch = useCallback((id: number | null) => {
    setSelectedBranchId(id);
    if (id !== null) {
      localStorage.setItem('selectedBranchId', id.toString());
    } else {
      localStorage.removeItem('selectedBranchId');
      // Clearing branch also clears department
      setSelectedDepartmentId(null);
      localStorage.removeItem('selectedDepartmentId');
    }
  }, []);

  const setDepartment = useCallback((id: number | null) => {
    setSelectedDepartmentId(id);
    if (id !== null) {
      localStorage.setItem('selectedDepartmentId', id.toString());
    } else {
      localStorage.removeItem('selectedDepartmentId');
    }
  }, []);

  const clearDepartment = useCallback(() => {
    setSelectedDepartmentId(null);
    localStorage.removeItem('selectedDepartmentId');
  }, []);

  const clearFilters = useCallback(() => {
    setSelectedBranchId(null);
    setSelectedDepartmentId(null);
    localStorage.removeItem('selectedBranchId');
    localStorage.removeItem('selectedDepartmentId');
  }, []);

  return (
    <FilterContext.Provider value={{ 
      selectedBranchId, 
      selectedDepartmentId, 
      setBranch, 
      setDepartment, 
      clearFilters,
      clearDepartment
    }}>
      {children}
    </FilterContext.Provider>
  );
}

export function useFilters() {
  const context = useContext(FilterContext);
  if (context === undefined) {
    throw new Error('useFilters must be used within a FilterProvider');
  }
  return context;
}
