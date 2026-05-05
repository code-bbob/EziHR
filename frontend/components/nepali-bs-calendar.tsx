"use client"

import * as React from "react"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { getTodayDate, getDaysInMonth, getFirstDayOfMonth } from "bs-ad-calendar-react"
import type { DateInfo } from "bs-ad-calendar-react"

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

export function NepaliBSCalendar() {
  const today = React.useMemo(() => getTodayDate("BS"), [])
  const [displayMonth, setDisplayMonth] = React.useState(() => ({
    year: today.year,
    month: today.month,
  }))

  const { bs, cells } = React.useMemo(
    () => createBsMonthGrid({ ...today, year: displayMonth.year, month: displayMonth.month }),
    [displayMonth.month, displayMonth.year, today]
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
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-1 pb-2">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Nepali BS Calendar</CardTitle>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={goToPreviousMonth}
              className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Previous BS month"
            >
              <ChevronLeftIcon className="size-4" />
            </button>
            <button
              type="button"
              onClick={goToCurrentMonth}
              className="rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              BS {toNepaliDigits(bs.year)}
            </button>
            <button
              type="button"
              onClick={goToNextMonth}
              className="inline-flex size-8 items-center justify-center rounded-full border border-border/60 bg-background text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label="Next BS month"
            >
              <ChevronRightIcon className="size-4" />
            </button>
          </div>
        </div>
        <CardDescription>
          {BS_MONTH_NAMES[bs.month]} {toNepaliDigits(bs.year)} · Today: {toNepaliDigits(today.day)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-3 p-2.5 pt-0">
        <div className="rounded-lg border bg-background p-2">
          <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground mb-2">
            {BS_WEEK_DAYS.map((day) => (
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

              const isToday =
                today.year === bs.year && today.month === bs.month && today.day === cell
              const holiday = holidays.find(
                (item) => item.month === bs.month && item.date === cell
              )
              const baseClass =
                "relative isolate z-10 flex aspect-square size-auto w-full min-w-[2.5rem] items-center justify-center border-0 px-1 leading-tight font-medium text-[0.75rem] transition-colors select-none rounded-md"
              const stateClass =
                isToday
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : holiday
                  ? "bg-emerald-50 text-emerald-800 hover:bg-emerald-100 dark:bg-emerald-500/10 dark:text-emerald-400"
                  : "bg-background hover:bg-muted/60"

              return (
                <button
                  key={cell}
                  type="button"
                  className={`${baseClass} ${stateClass}`}
                  aria-label={`BS date ${cell}`}
                >
                  {toNepaliDigits(cell)}
                </button>
              )
            })}
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
