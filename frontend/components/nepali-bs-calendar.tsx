"use client"

import * as React from "react"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"

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
const DAY_MS = 24 * 60 * 60 * 1000
const bsDateFormatter = new Intl.DateTimeFormat("en-NP-u-ca-bikram-sambat", {
  year: "numeric",
  month: "numeric",
  day: "numeric",
})

function toNepaliDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => NEPALI_DIGITS[Number(digit)])
}

function getBsParts(date: Date) {
  const parts = bsDateFormatter.formatToParts(date)
  const year = Number(parts.find((part) => part.type === "year")?.value ?? "0")
  const month = Number(parts.find((part) => part.type === "month")?.value ?? "0")
  const day = Number(parts.find((part) => part.type === "day")?.value ?? "0")
  return { year, month, day }
}

function createBsMonthGrid(referenceDate: Date) {
  const referenceBs = getBsParts(referenceDate)
  const firstDayDate = new Date(referenceDate.getTime() - (referenceBs.day - 1) * DAY_MS)
  const firstDayWeekday = firstDayDate.getDay()

  let daysInMonth = 0
  let probeDate = new Date(firstDayDate)
  while (true) {
    const bsParts = getBsParts(probeDate)
    if (bsParts.year !== referenceBs.year || bsParts.month !== referenceBs.month) {
      break
    }
    daysInMonth += 1
    probeDate = new Date(probeDate.getTime() + DAY_MS)
  }

  const cells = [
    ...Array.from({ length: firstDayWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, index) => index + 1),
  ]

  return {
    bs: referenceBs,
    cells,
  }
}

export function NepaliBSCalendar() {
  const today = React.useMemo(() => getBsParts(new Date()), [])
  const { bs, cells } = React.useMemo(
    () => createBsMonthGrid(new Date()),
    []
  )

  const holidays = [
    { month: bs.month, date: 1 },
    { month: bs.month, date: 18 },
    { month: bs.month, date: 29 },
  ]

  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="space-y-1 pb-3">
        <div className="flex items-center justify-between gap-3">
          <CardTitle className="text-base">Nepali BS Calendar</CardTitle>
          <Badge variant="outline" className="rounded-full">
            BS {toNepaliDigits(bs.year)}
          </Badge>
        </div>
        <CardDescription>
          {BS_MONTH_NAMES[bs.month - 1]} {toNepaliDigits(bs.year)} · Today: {toNepaliDigits(today.day)}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 p-3 pt-0">
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
