import { createDateOutput, ENGLISH_MONTHS_AD, NEPALI_MONTHS, type DateOutput } from "bs-ad-calendar-react"

export type CalendarSelection = DateOutput

function getTodayAdDate() {
  const today = new Date()
  return {
    year: today.getFullYear(),
    month: today.getMonth(),
    day: today.getDate(),
  }
}

export function getInitialCalendarSelection(): CalendarSelection {
  const today = getTodayAdDate()
  return createDateOutput("AD", today.year, today.month, today.day, ENGLISH_MONTHS_AD)
}

export function createAdSelection(year: number, month: number, day: number) {
  return createDateOutput("AD", year, month, day, ENGLISH_MONTHS_AD)
}

export function createBsSelection(year: number, month: number, day: number) {
  return createDateOutput("BS", year, month, day, NEPALI_MONTHS)
}

export function parseDateString(dateString: string) {
  const [year, month, day] = dateString.split("-").map((part) => Number(part))
  return {
    year,
    month: month - 1,
    day,
  }
}