"use client"

import * as React from "react"
import { Calendar } from 'bs-ad-calendar-react'
import { useRightSidebar } from "@/hooks/useRightSidebar"
import { SidebarContent } from "@/components/ui/sidebar"

export function SidebarRight({ ...props }: React.ComponentProps<'div'>) {
  const { isOpen } = useRightSidebar()

  return (
    // On large screens we render a sliding fixed panel that occupies the right whitespace.
    // On smaller screens the provider's Sheet UI can be used (not implemented here).
    <div
      aria-hidden={!isOpen}
      className={
        `fixed inset-y-0 right-0 z-30 w-96 transform transition-transform duration-300 ease-in-out ` +
        (isOpen ? 'translate-x-0' : 'translate-x-full')
      }
      {...props}
    >
      <div className="h-full border-l border-sidebar-border bg-gradient-to-b from-sidebar/80 via-sidebar/50 to-sidebar/80 backdrop-blur-2xl overflow-hidden">
        <SidebarContent className="min-h-0 overflow-y-auto px-4 py-4 scrollbar-hide">
          <div className="space-y-4">
            <section className="space-y-2">
              <div className="rounded-2xl border border-border/40 bg-background/40 p-3 shadow-sm backdrop-blur-md transition-all hover:border-primary/20 hover:shadow-md">
                <Calendar
                  calendarType="AD"
                  showToday
                  className="w-full"
                />
              </div>
            </section>

            <section className="space-y-2">
              <div className="rounded-2xl border border-border/40 bg-background/40 p-3 shadow-sm backdrop-blur-md transition-all hover:border-primary/20 hover:shadow-md">
                <Calendar
                  calendarType="BS"
                  showToday
                  className="w-full"
                />
              </div>
            </section>
          </div>
        </SidebarContent>
      </div>
    </div>
  )
}
