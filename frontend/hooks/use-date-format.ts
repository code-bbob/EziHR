/**
 * Hook for managing user's date format preference (AD or BS)
 * Fetches preference from current user's employee profile
 */

'use client';

import { useEffect, useState } from 'react';
import { apiClient } from '@/lib/api-client';

export type DateFormat = 'ad' | 'bs';

export function useDateFormatPreference() {
  const [dateFormat, setDateFormat] = useState<DateFormat>('ad');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadPreference = async () => {
      try {
        setLoading(true);
        // Get current user info
        const userInfo = await apiClient.auth.getCurrentUser();
        
        // If user has employee profile with date_format_preference, use it
        if (userInfo?.employee?.date_format_preference) {
          setDateFormat(userInfo.employee.date_format_preference);
        } else {
          // Default to 'ad'
          setDateFormat('ad');
        }
      } catch (err) {
        console.warn('Failed to load date format preference, using default:', err);
        setDateFormat('ad');
      } finally {
        setLoading(false);
      }
    };

    loadPreference();
  }, []);

  const updatePreference = async (newFormat: DateFormat): Promise<boolean> => {
    try {
      const userInfo = await apiClient.auth.getCurrentUser();
      if (!userInfo?.employee?.id) {
        throw new Error('No employee profile found');
      }

      // Update employee's date format preference
      await apiClient.employees.update(userInfo.employee.id, {
        date_format_preference: newFormat,
      });

      setDateFormat(newFormat);
      // Store in localStorage as backup
      localStorage.setItem('dateFormatPreference', newFormat);
      return true;
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      setError(errorMsg);
      return false;
    }
  };

  return {
    dateFormat,
    loading,
    error,
    updatePreference,
  };
}

/**
 * Hook to get user's current date format without side effects
 * Uses localStorage as fallback
 */
export function getDateFormatPreference(): DateFormat {
  if (typeof window === 'undefined') return 'ad';
  
  const stored = localStorage.getItem('dateFormatPreference');
  return (stored === 'bs' || stored === 'ad') ? stored : 'ad';
}

/**
 * Set date format preference in localStorage (used as cache/fallback)
 */
export function setDateFormatPreference(format: DateFormat) {
  if (typeof window !== 'undefined') {
    localStorage.setItem('dateFormatPreference', format);
  }
}
