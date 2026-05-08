'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Calendar as CalendarIcon } from 'lucide-react';
import { Button, buttonVariants } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { AdCalendar } from '@/components/ad-calendar';
import { NepaliBSCalendar } from '@/components/nepali-bs-calendar';
import { getDateFormatPreference, setDateFormatPreference, type DateFormat } from '@/hooks/use-date-format';
import { createAdSelection, createBsSelection, getInitialCalendarSelection, parseDateString, type CalendarSelection } from '@/lib/calendar-sync';
import { cn } from '@/lib/utils';

type FilterMode = 'single' | 'range';

type ApplyPayload = {
  dateFormat: DateFormat;
  startDate: string;
  endDate: string;
};

interface AttendanceDateFilterProps {
  mode?: FilterMode;
  title?: string;
  description?: string;
  initialDateFormat?: DateFormat;
  initialDate?: string;
  initialStartDate?: string;
  initialEndDate?: string;
  applyLabel?: string;
  onApply: (payload: ApplyPayload) => void;
}

function selectionFromDate(dateValue: string | undefined, format: 'ad' | 'bs'): CalendarSelection {
  if (!dateValue) {
    return getInitialCalendarSelection();
  }

  const parsed = parseDateString(dateValue);
  if (!parsed || !Number.isFinite(parsed.year) || !Number.isFinite(parsed.month) || !Number.isFinite(parsed.day)) {
    return getInitialCalendarSelection();
  }

  return format === 'bs'
    ? createBsSelection(parsed.year, parsed.month, parsed.day)
    : createAdSelection(parsed.year, parsed.month, parsed.day);
}

function currentValue(selection: CalendarSelection, dateFormat: DateFormat) {
  return selection[dateFormat];
}

type DateFieldProps = {
  label: string;
  placeholder: string;
  selection: CalendarSelection;
  dateFormat: DateFormat;
  onSelectionChange: (selection: CalendarSelection) => void;
};

function DateField({
  label,
  placeholder,
  selection,
  dateFormat,
  onSelectionChange,
}: DateFieldProps) {
  const [open, setOpen] = useState(false);
  const value = selection[dateFormat];

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        className={cn(
          buttonVariants({ variant: 'outline' }),
          'w-full justify-between gap-3 rounded-xl border-border/60 bg-background px-3 text-left text-sm font-normal shadow-sm transition-all hover:border-primary/40 hover:bg-muted/10',
          !value && 'text-muted-foreground'
        )}
      >
        <span className="truncate text-sm py-2 font-medium leading-none text-foreground">{value || placeholder}</span>
        <CalendarIcon className="size-4 shrink-0 text-muted-foreground" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-56 rounded-2xl border-border/70 p-2 shadow-lg">
        {dateFormat === 'ad' ? (
          <AdCalendar
            selectedDate={selection.ad}
            onDateSelect={(nextSelection) => {
              onSelectionChange(nextSelection);
              setOpen(false);
            }}
          />
        ) : (
          <NepaliBSCalendar
            selectedDate={selection.bs}
            onDateSelect={(nextSelection) => {
              onSelectionChange(nextSelection);
              setOpen(false);
            }}
          />
        )}
      </PopoverContent>
    </Popover>
  );
}

export function AttendanceDateFilter({
  mode = 'range',
  title = 'Attendance Date Filter',
  description = 'Switch between AD and BS and pick the calendar that matches your preference.',
  initialDateFormat,
  initialDate,
  initialStartDate,
  initialEndDate,
  applyLabel = 'Apply Filter',
  onApply,
}: AttendanceDateFilterProps) {
  const defaultFormat = initialDateFormat ?? getDateFormatPreference();
  const [dateFormat, setDateFormat] = useState<DateFormat>(defaultFormat);
  const [singleSelection, setSingleSelection] = useState<CalendarSelection>(() => selectionFromDate(initialDate, 'ad'));
  const [startSelection, setStartSelection] = useState<CalendarSelection>(() => selectionFromDate(initialStartDate, 'ad'));
  const [endSelection, setEndSelection] = useState<CalendarSelection>(() => selectionFromDate(initialEndDate, 'ad'));

  useEffect(() => {
    if (initialDateFormat) {
      setDateFormat(initialDateFormat);
    }
  }, [initialDateFormat]);

  const isSingle = mode === 'single';

  const handleFormatChange = (nextFormat: DateFormat) => {
    setDateFormat(nextFormat);
    setDateFormatPreference(nextFormat);
  };

  const appliedLabel = useMemo(() => {
    if (isSingle) {
      return currentValue(singleSelection, dateFormat);
    }

    return `${currentValue(startSelection, dateFormat)} → ${currentValue(endSelection, dateFormat)}`;
  }, [dateFormat, endSelection, isSingle, singleSelection, startSelection]);

  const handleApply = () => {
    if (isSingle) {
      const value = currentValue(singleSelection, dateFormat);
      onApply({
        dateFormat,
        startDate: value,
        endDate: value,
      });
      return;
    }

    onApply({
      dateFormat,
      startDate: currentValue(startSelection, dateFormat),
      endDate: currentValue(endSelection, dateFormat),
    });
  };

  return (
    <Card className="w-full rounded-2xl border-border/60 shadow-sm">
      <CardContent className="pt-4">
        <div className="flex flex-col gap-4">
          <div className={cn('flex gap-4 flex-wrap', isSingle ? 'flex-col' : '')}>
            {!isSingle && (
              <>
                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Start Date</span>
                  <DateField
                    label="Start Date"
                    placeholder="Select start"
                    selection={startSelection}
                    dateFormat={dateFormat}
                    onSelectionChange={setStartSelection}
                  />
                </div>

                <div className="flex flex-col gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">End Date</span>
                  <DateField
                    label="End Date"
                    placeholder="Select end"
                    selection={endSelection}
                    dateFormat={dateFormat}
                    onSelectionChange={setEndSelection}
                  />
                </div>
              </>
            )}

            {isSingle && (
              <div className="flex flex-col gap-2">
                <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/80">Date</span>
                <DateField
                  label="Date"
                  placeholder="Select date"
                  selection={singleSelection}
                  dateFormat={dateFormat}
                  onSelectionChange={setSingleSelection}
                />
              </div>
            )}
          </div>

          <div className="flex items-center justify-between gap-3">
            <Button type="button" onClick={handleApply} className="h-9 rounded-full px-5 font-medium">
              {applyLabel}
            </Button>
            <div className="inline-flex w-fit rounded-full border border-border/60 bg-muted/30 p-1 shadow-sm">
              <Button
                type="button"
                size="sm"
                variant={dateFormat === 'ad' ? 'default' : 'ghost'}
                onClick={() => handleFormatChange('ad')}
                className={cn('h-8 rounded-full px-3 text-xs font-medium', dateFormat !== 'ad' && 'text-muted-foreground')}
              >
                AD
              </Button>
              <Button
                type="button"
                size="sm"
                variant={dateFormat === 'bs' ? 'default' : 'ghost'}
                onClick={() => handleFormatChange('bs')}
                className={cn('h-8 rounded-full px-3 text-xs font-medium', dateFormat !== 'bs' && 'text-muted-foreground')}
              >
                BS
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
