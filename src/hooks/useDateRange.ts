import { useEffect, useState } from 'react';
import { getEnvironmentSpecificItem, setEnvironmentSpecificItem } from '../lib/api';

export function useDateRange() {
  const [startDate, setStartDate] = useState<Date | null>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-stats-start-date');
      if (saved && typeof saved === 'string') {
        const date = new Date(saved);
        // Validate the date is valid
        if (!isNaN(date.getTime())) {
          date.setHours(0, 0, 0, 0);
          return date;
        }
      }
    } catch (_error) {
      // Fallback to default
    }
    // Default to yesterday (full day)
    const date = new Date();
    date.setDate(date.getDate() - 1);
    date.setHours(0, 0, 0, 0);
    return date;
  });

  const [endDate, setEndDate] = useState<Date | null>(() => {
    try {
      const saved = getEnvironmentSpecificItem('chatbot-dashboard-stats-end-date');
      if (saved && typeof saved === 'string') {
        const date = new Date(saved);
        // Validate the date is valid
        if (!isNaN(date.getTime())) {
          date.setHours(23, 59, 59, 999);
          return date;
        }
      }
    } catch (_error) {
      // Fallback to default
    }
    // Default to today (end of current day)
    const date = new Date();
    date.setHours(23, 59, 59, 999);
    return date;
  });

  // Save to localStorage when dates change
  useEffect(() => {
    try {
      if (startDate) {
        setEnvironmentSpecificItem('chatbot-dashboard-stats-start-date', startDate.toISOString());
      }
    } catch (_error) {
      // Silently fail
    }
  }, [startDate]);

  useEffect(() => {
    try {
      if (endDate) {
        setEnvironmentSpecificItem('chatbot-dashboard-stats-end-date', endDate.toISOString());
      }
    } catch (_error) {
      // Silently fail
    }
  }, [endDate]);

  return {
    startDate,
    endDate,
    setStartDate,
    setEndDate,
  };
}
