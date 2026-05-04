"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
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
  const { year, month, cells } = React.useMemo(() => createAdMonthGrid(new Date()), [])

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">AD Calendar</CardTitle>
          <Badge variant="outline" className="rounded-full">
            {year}
          </Badge>
        </div>
        <CardDescription>
          {AD_MONTH_NAMES[month]} {year} · Today: {today.date}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-3 pt-0">
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
