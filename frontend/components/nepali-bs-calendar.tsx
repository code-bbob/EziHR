"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { getTodayDate, getDaysInMonth, getFirstDayOfMonth } from "bs-ad-calendar-react"
import type { DateInfo } from "bs-ad-calendar-react"
import { createBsSelection, parseDateString, type CalendarSelection } from "@/lib/calendar-sync"

const BS_MONTH_NAMES = [
  "बैशाख",
  "जेठ",
  "असार",
  "श्रावण",
  "भाद्र",
  "आश्विन",
  "कार्तिक",
  "मंसिर",
  "पुष",
  "माघ",
  "फाल्गुन",
  "चैत",
]

const BS_WEEK_DAYS = ["आइत", "सोम", "मंगल", "बुध", "बिही", "शुक्र", "शनि"]
const NEPALI_DIGITS = ["०", "१", "२", "३", "४", "५", "६", "७", "८", "९"]

type MonthState = {
  year: number
  month: number
}

type NepaliBSCalendarProps = {
  selectedDate?: string
  onDateSelect?: (selection: CalendarSelection) => void
}

function toNepaliDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => NEPALI_DIGITS[Number(digit)])
}

function createBsMonthGrid(today: DateInfo) {
  const year = today.year
  const month = today.month
  const daysInMonth = getDaysInMonth("BS", year, month)
  const firstDayWeekday = getFirstDayOfMonth("BS", year, month)

  const cells = [
    ...Array.from({ length: firstDayWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return {
    bs: { year, month, day: today.day },
    cells,
  }
}

export function NepaliBSCalendar({ selectedDate, onDateSelect }: NepaliBSCalendarProps) {
  const today = React.useMemo(() => getTodayDate("BS"), [])
  const [displayMonth, setDisplayMonth] = React.useState<MonthState>(() => ({
    year: selectedDate ? parseDateString(selectedDate).year : today.year,
    month: selectedDate ? parseDateString(selectedDate).month : today.month,
  }))

  // Sync the displayed month/year whenever the selectedDate prop changes
  // (e.g. switching from AD→BS causes the parent to pass a new BS date string)
  React.useEffect(() => {
    if (selectedDate) {
      const parsed = parseDateString(selectedDate)
      if (Number.isFinite(parsed.year) && Number.isFinite(parsed.month)) {
        setDisplayMonth({ year: parsed.year, month: parsed.month })
      }
    } else {
      setDisplayMonth({ year: today.year, month: today.month })
    }
  }, [selectedDate, today.year, today.month])

  const { bs, cells } = React.useMemo(
    () => createBsMonthGrid({ ...today, year: displayMonth.year, month: displayMonth.month }),
    [displayMonth.month, displayMonth.year, today]
  )

  const selectedParts = React.useMemo(
    () => (selectedDate ? parseDateString(selectedDate) : null),
    [selectedDate]
  )

  const goToPreviousMonth = React.useCallback(() => {
    setDisplayMonth((current) => {
      if (current.month === 1) {
        return { year: current.year - 1, month: 12 }
      }

      return { year: current.year, month: current.month - 1 }
    })
  }, [])

  const goToNextMonth = React.useCallback(() => {
    setDisplayMonth((current) => {
      if (current.month === 12) {
        return { year: current.year + 1, month: 1 }
      }

      return { year: current.year, month: current.month + 1 }
    })
  }, [])

  const goToCurrentMonth = React.useCallback(() => {
    setDisplayMonth({ year: today.year, month: today.month })
  }, [today.month, today.year])

  const holidays = [
    { month: bs.month, date: 1 },
    { month: bs.month, date: 18 },
    { month: bs.month, date: 29 },
  ]

  return (
    <div className="w-fit">
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Previous BS month"
        >
          <ChevronLeftIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={goToCurrentMonth}
          className="text-xs font-semibold text-foreground min-w-fit"
        >
          {BS_MONTH_NAMES[bs.month]} {toNepaliDigits(bs.year)}
        </button>
        <button
          type="button"
          onClick={goToNextMonth}
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Next BS month"
        >
          <ChevronRightIcon className="size-3.5" />
        </button>
      </div>
      <div className="bg-background rounded-lg p-2">
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {BS_WEEK_DAYS.map((day) => (
            <div key={day} className="w-7 h-6 flex items-center justify-center text-[0.65rem] font-medium text-muted-foreground/70">
              {day}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 gap-1">
          {cells.map((cell, index) => {
            if (cell === null) {
              return <div key={`empty-${index}`} className="w-7 h-7" />
            }

            const isToday =
              today.year === bs.year && today.month === bs.month && today.day === cell
            const isSelected =
              selectedParts?.year === bs.year &&
              selectedParts?.month === bs.month &&
              selectedParts?.day === cell
            const holiday = holidays.find(
              (item) => item.month === bs.month && item.date === cell
            )
            const baseClass =
              "w-7 h-7 flex items-center justify-center text-xs font-medium rounded-md cursor-pointer transition-colors select-none"
            const stateClass =
              isToday
                ? "bg-primary/90 text-primary-foreground font-semibold"
                : isSelected
                ? "bg-primary/20 text-foreground font-semibold"
                : holiday
                ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:text-emerald-400"
                : "text-foreground/80 hover:bg-muted/60"

            const dateSelection = createBsSelection(bs.year, bs.month, cell)

            return (
              <button
                key={cell}
                type="button"
                className={`${baseClass} ${stateClass}`}
                aria-label={`BS date ${cell}`}
                onClick={() => onDateSelect?.(dateSelection)}
              >
                {toNepaliDigits(cell)}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
