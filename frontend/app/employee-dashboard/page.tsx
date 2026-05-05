'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/hooks/useAuth';
import { apiClient } from '@/lib/api-client';
import { Navbar } from '@/components/Navbar';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

interface EmployeeStats {
    present_days: number;
    absent_days: number;
    total_worked_hours: number;
    current_month: string;
}

interface EmployeeData {
    employee: any;
    today_attendance: any;
    stats: EmployeeStats;
    recent_history: any[];
}

export default function EmployeeDashboard() {
    const { user, loading: authLoading, isAuthenticated } = useAuth();
    const router = useRouter();
    const [data, setData] = useState<EmployeeData | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (!authLoading && !isAuthenticated) {
            router.push('/login');
        } else if (!authLoading && isAuthenticated && user?.is_admin) {
            // Admins should see the main dashboard
            router.push('/');
        }
    }, [authLoading, isAuthenticated, user, router]);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const result = await apiClient.dashboard.getEmployeeDashboard();
                setData(result);
            } catch (err: any) {
                setError(err.message || 'Failed to load dashboard data');
            } finally {
                setLoading(false);
            }
        };

        if (isAuthenticated && !user?.is_admin) {
            fetchData();
        }
    }, [isAuthenticated, user]);

    if (authLoading || (loading && !error)) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex flex-col">
                <Navbar title="EziHR - My Dashboard" />
                <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8 space-y-6 max-w-7xl mx-auto w-full">
                    <Skeleton className="h-10 w-1/3 mb-6" />
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                        <Skeleton className="h-32 w-full" />
                    </div>
                    <Skeleton className="h-64 w-full mt-6" />
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-zinc-50 dark:bg-[#0a0a0a] flex items-center justify-center">
                <div className="text-center p-6 bg-white dark:bg-zinc-900/50 backdrop-blur-md rounded-xl shadow-lg border border-red-200 dark:border-red-900/50 max-w-md">
                    <h2 className="text-xl font-bold text-red-600 mb-2">Error Loading Dashboard</h2>
                    <p className="text-zinc-600 dark:text-zinc-400 mb-4">{error}</p>
                    <button
                        onClick={() => window.location.reload()}
                        className="bg-red-600 hover:bg-red-700 text-white font-medium py-2 px-6 rounded-full transition-all duration-300 transform hover:scale-105"
                    >
                        Retry
                    </button>
                </div>
            </div>
        );
    }

    const { employee, today_attendance, stats, recent_history } = data || {};

    return (
        <div className="min-h-screen bg-gradient-to-b from-zinc-50 to-zinc-100 dark:from-[#0a0a0a] dark:to-[#111] flex flex-col font-sans">
            <Navbar title="EziHR - My Space" />
            <div className="flex-1 py-12 px-4 sm:px-6 lg:px-8 w-full">
                <div className="max-w-7xl mx-auto space-y-8 tracking-tight">

                    {/* Header Section */}
                    <div className="flex flex-col md:flex-row items-start md:items-center justify-between mb-10 gap-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <div>
                            <h1 className="text-4xl lg:text-5xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 mb-2">
                                Hello, {employee?.name?.split(' ')[0] || 'There'}! 👋
                            </h1>
                            <p className="text-lg text-zinc-600 dark:text-zinc-400 font-medium">
                                Here's what's happening with your attendance today.
                            </p>
                        </div>

                        {/* Status Badge */}
                        <div className="bg-white/60 dark:bg-zinc-900/40 backdrop-blur-xl border border-zinc-200 dark:border-zinc-800 p-4 rounded-2xl shadow-sm flex items-center gap-4">
                            <div className="flex items-center gap-2">
                                <span className="text-sm text-zinc-500 dark:text-zinc-400 font-medium">Today's Status</span>
                                {today_attendance?.present ? (
                                    <Badge className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 shadow-none border-0 text-sm px-3 py-1 animate-pulse">
                                        🟢 Present
                                    </Badge>
                                ) : (
                                    <Badge variant="secondary" className="bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300 hover:bg-zinc-200 shadow-none border-0 text-sm px-3 py-1">
                                        ⚪ Not Arrived
                                    </Badge>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Stats Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
                        <StatCard
                            title="Time Logged"
                            value={`${stats?.total_worked_hours || 0}h`}
                            desc={`Total this ${stats?.current_month}`}
                            icon="⌛"
                            color="blue"
                            delay={100}
                        />
                        <StatCard
                            title="Days Present"
                            value={stats?.present_days || 0}
                            desc={`Active days in ${stats?.current_month}`}
                            icon="🎯"
                            color="emerald"
                            delay={200}
                        />
                        <StatCard
                            title="Days Absent"
                            value={stats?.absent_days || 0}
                            desc={`Missed in ${stats?.current_month}`}
                            icon="🏖️"
                            color="amber"
                            delay={300}
                        />
                        <StatCard
                            title="Avg Daily"
                            value={(stats && stats.present_days > 0) ? `${(stats.total_worked_hours / stats.present_days).toFixed(1)}h` : '0h'}
                            desc="Average hours per day"
                            icon="📈"
                            color="indigo"
                            delay={400}
                        />
                    </div>

                    {/* Table Section */}
                    <div className="animate-in fade-in slide-in-from-bottom-8 duration-700 delay-500 fill-mode-both mt-10">
                        <Card className="border-0 shadow-xl shadow-blue-900/5 dark:shadow-black/40 bg-white/70 dark:bg-zinc-900/50 backdrop-blur-2xl overflow-hidden rounded-3xl">
                            <CardHeader className="px-8 pt-8 pb-6 border-b border-zinc-100 dark:border-zinc-800">
                                <CardTitle className="text-2xl font-bold dark:text-white">Recent Activity</CardTitle>
                                <CardDescription className="text-zinc-500 text-base">Your attendance log for the last 7 days</CardDescription>
                            </CardHeader>
                            <CardContent className="p-0">
                                <div className="overflow-x-auto">
                                    <Table>
                                        <TableHeader className="bg-zinc-50/50 dark:bg-zinc-800/30">
                                            <TableRow className="border-none hover:bg-transparent">
                                                <TableHead className="py-5 px-8 font-semibold text-zinc-600 dark:text-zinc-300">Date</TableHead>
                                                <TableHead className="py-5 font-semibold text-zinc-600 dark:text-zinc-300">Status</TableHead>
                                                <TableHead className="py-5 hidden md:table-cell font-semibold text-zinc-600 dark:text-zinc-300">First In</TableHead>
                                                <TableHead className="py-5 hidden md:table-cell font-semibold text-zinc-600 dark:text-zinc-300">Last Out</TableHead>
                                                <TableHead className="py-5 px-8 text-right font-semibold text-zinc-600 dark:text-zinc-300">Hours</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {recent_history && recent_history.length > 0 ? (
                                                recent_history.map((record, index) => (
                                                    <TableRow
                                                        key={index}
                                                        className="border-b border-zinc-100 dark:border-zinc-800/50 hover:bg-zinc-50 dark:hover:bg-zinc-800/50 transition-colors"
                                                    >
                                                        <TableCell className="py-4 px-8 font-medium dark:text-zinc-200">
                                                            {new Date(record.attendance_date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
                                                        </TableCell>
                                                        <TableCell className="py-4">
                                                            {record.present ? (
                                                                <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20 font-normal shadow-none">Present</Badge>
                                                            ) : (
                                                                <Badge className="bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20 font-normal shadow-none">Absent</Badge>
                                                            )}
                                                        </TableCell>
                                                        <TableCell className="py-4 hidden md:table-cell text-zinc-500 dark:text-zinc-400">
                                                            {record.first_check_in ? new Date(record.first_check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </TableCell>
                                                        <TableCell className="py-4 hidden md:table-cell text-zinc-500 dark:text-zinc-400">
                                                            {record.last_check_out ? new Date(record.last_check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}
                                                        </TableCell>
                                                        <TableCell className="py-4 px-8 text-right font-semibold font-mono text-zinc-700 dark:text-zinc-300">
                                                            {(record.worked_minutes / 60).toFixed(1)}h
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            ) : (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="text-center py-12 text-zinc-500">
                                                        No recent attendance records found.
                                                    </TableCell>
                                                </TableRow>
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </CardContent>
                        </Card>
                    </div>

                </div>
            </div>
        </div>
    );
}

// Reusable Stat Card Component
function StatCard({ title, value, desc, icon, color, delay }: { title: string, value: string | number, desc: string, icon: string, color: 'blue' | 'emerald' | 'amber' | 'indigo', delay: number }) {
    const colorMap = {
        blue: 'from-blue-500 to-cyan-500 text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-500/10 border-blue-100 dark:border-blue-500/20 group-hover:shadow-blue-500/20',
        emerald: 'from-emerald-400 to-teal-500 text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 border-emerald-100 dark:border-emerald-500/20 group-hover:shadow-emerald-500/20',
        amber: 'from-amber-400 to-orange-500 text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 group-hover:shadow-amber-500/20',
        indigo: 'from-indigo-500 to-purple-500 text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10 border-indigo-100 dark:border-indigo-500/20 group-hover:shadow-indigo-500/20'
    };

    const selectedColor = colorMap[color];

    return (
        <Card
            className={`group border-0 shadow-lg shadow-zinc-200/40 dark:shadow-none bg-white/80 dark:bg-zinc-900/60 backdrop-blur-xl overflow-hidden rounded-3xl transition-all duration-300 hover:-translate-y-1 hover:shadow-xl ${selectedColor.split(' ').find(c => c.startsWith('group-hover:shadow-'))} animate-in fade-in slide-in-from-bottom-8 fill-mode-both`}
            style={{ animationDelay: `${delay}ms`, animationDuration: '700ms' }}
        >
            <CardContent className="p-6 relative">
                <div className={`absolute top-0 right-0 w-24 h-24 -mr-8 -mt-8 rounded-full bg-gradient-to-br ${selectedColor.split(' ')[0]} ${selectedColor.split(' ')[1]} opacity-10 dark:opacity-20 blur-2xl group-hover:opacity-20 dark:group-hover:opacity-30 transition-opacity duration-500`}></div>
                <div className="flex justify-between items-start mb-4">
                    <div>
                        <p className="text-zinc-500 dark:text-zinc-400 font-medium mb-1 text-sm">{title}</p>
                        <h3 className="text-4xl font-bold text-zinc-900 dark:text-white tracking-tight">{value}</h3>
                    </div>
                    <div className={`p-3 rounded-2xl ${selectedColor.split(' ').find(c => c.startsWith('bg-'))} ${selectedColor.split(' ').find(c => c.startsWith('dark:bg-'))} ${selectedColor.split(' ').find(c => c.startsWith('text-'))} ${selectedColor.split(' ').find(c => c.startsWith('dark:text-'))} flex items-center justify-center text-xl shadow-sm border ${selectedColor.split(' ').find(c => c.startsWith('border-'))} ${selectedColor.split(' ').find(c => c.startsWith('dark:border-'))}`}>
                        {icon}
                    </div>
                </div>
                <p className="text-sm text-zinc-500 dark:text-zinc-500 font-medium">
                    {desc}
                </p>
            </CardContent>
        </Card>
    );
}
