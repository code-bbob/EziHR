'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useDateFormatPreference, type DateFormat } from '@/hooks/use-date-format';
import { DateFormatBadge } from '@/components/DateDisplay';

/**
 * Component for user to select their preferred date format
 * Shows both AD (Gregorian) and BS (Nepali) options
 */
export function DateFormatPreferences() {
  const { dateFormat, loading, updatePreference } = useDateFormatPreference();
  const [selectedFormat, setSelectedFormat] = useState<DateFormat>(dateFormat);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    setSelectedFormat(dateFormat);
  }, [dateFormat]);

  const handleSave = async () => {
    if (selectedFormat === dateFormat) {
      setMessage({ type: 'success', text: 'No changes to save' });
      setTimeout(() => setMessage(null), 3000);
      return;
    }

    setSaving(true);
    try {
      const success = await updatePreference(selectedFormat);
      if (success) {
        setMessage({ type: 'success', text: 'Date format preference updated successfully!' });
        setTimeout(() => setMessage(null), 3000);
      } else {
        setMessage({ type: 'error', text: 'Failed to update preference' });
      }
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Date Format Preference</CardTitle>
          <CardDescription>Choose how dates are displayed throughout the application</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-4">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Date Format Preference</CardTitle>
        <CardDescription>Choose how dates are displayed throughout the application</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-3">
          {/* AD Format Option */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setSelectedFormat('ad')}>
            <input
              type="radio"
              id="format-ad"
              name="dateFormat"
              value="ad"
              checked={selectedFormat === 'ad'}
              onChange={(e) => setSelectedFormat(e.target.value as DateFormat)}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <label htmlFor="format-ad" className="font-medium cursor-pointer">
                Gregorian Calendar (AD)
              </label>
              <p className="text-sm text-muted-foreground">
                Display dates like <strong>2026-05-05</strong> (May 5, 2026)
              </p>
            </div>
            {selectedFormat === 'ad' && <DateFormatBadge format="ad" />}
          </div>

          {/* BS Format Option */}
          <div className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-muted transition-colors"
            onClick={() => setSelectedFormat('bs')}>
            <input
              type="radio"
              id="format-bs"
              name="dateFormat"
              value="bs"
              checked={selectedFormat === 'bs'}
              onChange={(e) => setSelectedFormat(e.target.value as DateFormat)}
              className="w-4 h-4"
            />
            <div className="flex-1">
              <label htmlFor="format-bs" className="font-medium cursor-pointer">
                Nepali Calendar (BS / Bikram Sambat)
              </label>
              <p className="text-sm text-muted-foreground">
                Display dates like <strong>2083-01-21</strong> (Jestha 21, 2083)
              </p>
            </div>
            {selectedFormat === 'bs' && <DateFormatBadge format="bs" />}
          </div>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`p-3 rounded-lg text-sm ${
            message.type === 'success'
              ? 'bg-green-100 text-green-800'
              : 'bg-red-100 text-red-800'
          }`}>
            {message.text}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleSave}
            disabled={saving || selectedFormat === dateFormat}
            className="flex-1"
          >
            {saving ? 'Saving...' : 'Save Preference'}
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelectedFormat(dateFormat)}
            disabled={selectedFormat === dateFormat}
            className="flex-1"
          >
            Cancel
          </Button>
        </div>

        {/* Info Section */}
        <div className="bg-muted p-4 rounded-lg text-sm space-y-2">
          <p className="font-medium">About Date Formats:</p>
          <ul className="list-disc list-inside space-y-1 text-muted-foreground">
            <li><strong>AD:</strong> Gregorian calendar used internationally (year 2026)</li>
            <li><strong>BS:</strong> Nepali calendar system also known as Vikram Samvat (year 2083)</li>
          </ul>
          <p className="text-muted-foreground text-xs pt-2">
            Both formats represent the same date - just in different calendar systems.
            Your attendance records store both dates automatically.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
