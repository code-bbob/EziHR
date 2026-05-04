// components/StatCard.tsx
interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ReactNode;
}

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <div className="bg-white dark:bg-zinc-900 rounded-lg shadow p-6">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <h3 className="text-sm font-medium text-zinc-500 dark:text-zinc-400">{title}</h3>
          <p className="mt-2 text-3xl font-bold text-zinc-900 dark:text-white">{value}</p>
          {description && (
            <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-500">{description}</p>
          )}
        </div>
        {icon && (
          <div className="text-3xl text-blue-600 dark:text-blue-400">{icon}</div>
        )}
      </div>
    </div>
  );
}
