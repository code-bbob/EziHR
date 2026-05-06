"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { createAdSelection, parseDateString, type CalendarSelection } from "@/lib/calendar-sync"

const AD_MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"
]

const AD_WEEK_DAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"]

function createAdMonthGrid(referenceDate: Date) {
  const year = referenceDate.getFullYear()
  const month = referenceDate.getMonth()
  const firstDay = new Date(year, month, 1)
  const firstDayWeekday = firstDay.getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()

  const cells = [
    ...Array.from({ length: firstDayWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return {
    year,
    month,
    daysInMonth,
    cells,
  }
}

type AdCalendarProps = {
  selectedDate?: string
  onDateSelect?: (selection: CalendarSelection) => void
}

type MonthState = {
  year: number
  month: number
}

export function AdCalendar({ selectedDate, onDateSelect }: AdCalendarProps) {
  const today = React.useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), date: d.getDate() }
  }, [])
  const [displayMonth, setDisplayMonth] = React.useState<MonthState>(() => ({
    year: selectedDate ? parseDateString(selectedDate).year : today.year,
    month: selectedDate ? parseDateString(selectedDate).month : today.month,
  }))

  // Sync the displayed month/year whenever the selectedDate prop changes
  // (e.g. switching from BS→AD causes the parent to pass a new AD date string)
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

  const { year, month, cells } = React.useMemo(
    () => createAdMonthGrid(new Date(displayMonth.year, displayMonth.month, 1)),
    [displayMonth]
  )

  const goToPreviousMonth = React.useCallback(() => {
    setDisplayMonth((current) => {
      if (current.month === 0) {
        return { year: current.year - 1, month: 11 }
      }

      return { year: current.year, month: current.month - 1 }
    })
  }, [])

  const goToNextMonth = React.useCallback(() => {
    setDisplayMonth((current) => {
      if (current.month === 11) {
        return { year: current.year + 1, month: 0 }
      }

      return { year: current.year, month: current.month + 1 }
    })
  }, [])

  const goToCurrentMonth = React.useCallback(() => {
    setDisplayMonth({ year: today.year, month: today.month })
  }, [today.month, today.year])

  const selectedParts = React.useMemo(
    () => (selectedDate ? parseDateString(selectedDate) : null),
    [selectedDate]
  )

  return (
    <div className="w-fit">
      <div className="flex items-center justify-between gap-2 mb-3 px-1">
        <button
          type="button"
          onClick={goToPreviousMonth}
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Previous month"
        >
          <ChevronLeftIcon className="size-3.5" />
        </button>
        <button
          type="button"
          onClick={goToCurrentMonth}
          className="text-xs font-semibold text-foreground min-w-fit"
        >
          {AD_MONTH_NAMES[month]} {year}
        </button>
        <button
          type="button"
          onClick={goToNextMonth}
          className="inline-flex size-6 items-center justify-center rounded-full text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
          aria-label="Next month"
        >
          <ChevronRightIcon className="size-3.5" />
        </button>
      </div>
      <div className="bg-background rounded-lg p-2">
        <div className="grid grid-cols-7 gap-1 text-center mb-1">
          {AD_WEEK_DAYS.map((day) => (
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

            const isToday = today.year === year && today.month === month && today.date === cell
            const isSelected =
              selectedParts?.year === year &&
              selectedParts?.month === month &&
              selectedParts?.day === cell

            const baseClass =
              "w-7 h-7 flex items-center justify-center text-xs font-medium rounded-md cursor-pointer transition-colors select-none"
            const stateClass =
              isToday
                ? "bg-primary/90 text-primary-foreground font-semibold"
                : isSelected
                ? "bg-primary/20 text-foreground font-semibold"
                : "text-foreground/80 hover:bg-muted/60"

            const dateSelection = createAdSelection(year, month, cell)

            return (
              <button
                key={cell}
                type="button"
                className={`${baseClass} ${stateClass}`}
                aria-label={`AD date ${cell}`}
                onClick={() => onDateSelect?.(dateSelection)}
              >
                {cell}
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
