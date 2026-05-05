"use client"

import * as React from "react"
import { useRightSidebar } from "@/hooks/useRightSidebar"
import { SidebarContent } from "@/components/ui/sidebar"
import { AdCalendar } from "@/components/ad-calendar"
import { NepaliBSCalendar } from "@/components/nepali-bs-calendar"

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
      <div className="flex h-full flex-col border-l border-sidebar-border bg-gradient-to-b from-sidebar/80 via-sidebar/50 to-sidebar/80 backdrop-blur-2xl overflow-hidden">
        <SidebarContent className="min-h-0 flex-1 overflow-y-auto px-4 py-4 pr-3">
          <div className="space-y-3">
            <section className="space-y-2">
              <NepaliBSCalendar />
            </section>

            <section className="space-y-2">
              <AdCalendar />
            </section>
          </div>
        </SidebarContent>
      </div>
    </div>
  )
}
