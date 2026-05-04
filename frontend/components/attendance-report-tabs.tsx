"use client";

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { cn } from '@/lib/utils';

const tabs = [
  { href: '/attendance', label: 'Daily Attendance ' },
  { href: '/attendance/reports/late-arrivals', label: 'Late Arrivals' },
  { href: '/attendance/reports/early-departures', label: 'Early Departures' },
  { href: '/attendance/reports/monthly-summary', label: 'Monthly Summary' },
  { href: '/attendance/reports/monthly-summary-detailed', label: 'Detailed Monthly' },
];

export function AttendanceReportTabs() {
  const pathname = usePathname();

  return (
    <div className="border-b border-border/60 bg-background/95  py-3 backdrop-blur supports-[backdrop-filter]:bg-background/80 ">
      <nav className="flex flex-wrap gap-2">
        {tabs.map((tab) => {
          const isActive = pathname === tab.href;

          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={cn(
                'inline-flex items-center rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'border-primary bg-primary/10 text-primary'
                  : 'border-transparent text-muted-foreground hover:border-border hover:bg-muted hover:text-foreground'
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}