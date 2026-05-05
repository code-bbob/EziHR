"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"

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

export function AdCalendar() {
  const today = React.useMemo(() => {
    const d = new Date()
    return { year: d.getFullYear(), month: d.getMonth(), date: d.getDate() }
  }, [])
  const [displayMonth, setDisplayMonth] = React.useState(() => ({
    year: today.year,
    month: today.month,
  }))

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

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">AD Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Previous month"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={goToCurrentMonth}
              className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              {year}
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Next month"
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        </div>
        <CardDescription>
          {AD_MONTH_NAMES[month]} {year} · Today: {today.date}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-2.5 pt-0">
        <div className="rounded-lg border bg-background p-2">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground mb-2">
            {AD_WEEK_DAYS.map((day) => (
              <div key={day} className="py-1">
                {day}
              </div>
            ))}
          </div>

          <div className="grid grid-cols-7 gap-1">
            {cells.map((cell, index) => {
              if (cell === null) {
                return <div key={`empty-${index}`} className="aspect-square rounded-md bg-transparent" />
              }

              const isToday = today.year === year && today.month === month && today.date === cell

              const baseClass =
                "relative isolate z-10 flex aspect-square size-auto w-full min-w-[2.5rem] items-center justify-center border-0 px-1 leading-tight font-medium text-[0.75rem] transition-colors select-none rounded-md"
              const stateClass =
                isToday
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "bg-background hover:bg-muted/60"

              return (
                <button
                  key={cell}
                  type="button"
                  className={`${baseClass} ${stateClass}`}
                  aria-label={`AD date ${cell}`}
                >
                  {cell}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
