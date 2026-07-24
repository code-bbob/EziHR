"use client"

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { Navbar } from '@/components/Navbar'
import { AttendanceReportTabs } from '@/components/attendance-report-tabs'
import { DashboardSidebar } from '@/components/dashboard-sidebar'
import { SidebarRight } from '@/components/sidebar-right'
import { SidebarInset, SidebarProvider } from '@/components/ui/sidebar'
import { apiClient, type DashboardData, type HierarchicalDashboardData } from '@/lib/api-client'
import { useAuth } from '@/lib/hooks/useAuth'
import { useFilters } from '@/hooks/useFilters'
import { useDateFormatPreference } from '@/hooks/use-date-format'

export function AppShell({ children }: { children: React.ReactNode }) {
	const router = useRouter()
	const pathname = usePathname()
	const searchParams = useSearchParams()
	const { isAuthenticated } = useAuth()
	const {
		selectedBranchId,
		selectedDepartmentId,
		setBranch,
		setDepartment,
		clearFilters,
		clearDepartment,
	} = useFilters()
	const { dateFormat, loading: datePrefLoading } = useDateFormatPreference()

	const syncSelectionToUrl = useCallback(
		(branchId: number | null, departmentId: number | null) => {
			const params = new URLSearchParams(searchParams.toString())

			if (branchId !== null) {
				params.set('branch', String(branchId))
			} else {
				params.delete('branch')
			}

			if (departmentId !== null) {
				params.set('department', String(departmentId))
			} else {
				params.delete('department')
			}

			const query = params.toString()
			router.replace(query ? `${pathname}?${query}` : pathname)
		},
		[pathname, router, searchParams]
	)

	const [hierarchicalData, setHierarchicalData] = useState<HierarchicalDashboardData | null>(null)
	const [attendanceData, setAttendanceData] = useState<DashboardData | null>(null)
	const [employeeList, setEmployeeList] = useState<any[]>([])
	const [employeeCount, setEmployeeCount] = useState<number>(0)
	const isAuthPage = pathname === '/login' || pathname?.startsWith('/login/')

	useEffect(() => {
		if (!isAuthenticated) return
		if (datePrefLoading) return

		let cancelled = false

		const load = async () => {
			try {
				console.debug('[app-shell] load-dashboard', {
					selectedBranchId,
					selectedDepartmentId,
					dateFormat,
				})
				const [hier, attendance, employeesResp] = await Promise.all([
					apiClient.dashboard.getHierarchical(),
					apiClient.dashboard.getAttendance(selectedBranchId, selectedDepartmentId, dateFormat),
					apiClient.employees.listWithFilters?.(selectedBranchId, selectedDepartmentId) ?? apiClient.employees.list(),
				])

				if (!cancelled) {
					setHierarchicalData(hier)
					setAttendanceData(attendance)
					setEmployeeList(employeesResp?.results || employeesResp?.data || [])
					setEmployeeCount(employeesResp?.count || (employeesResp?.results?.length ?? 0))
				}
			} catch {
				if (!cancelled) {
					setHierarchicalData(null)
					setAttendanceData(null)
					setEmployeeList([])
					setEmployeeCount(0)
				}
			}
		}

		load()

		return () => {
			cancelled = true
		}
	}, [isAuthenticated, selectedBranchId, selectedDepartmentId, dateFormat, datePrefLoading])

	const totalEmployees = attendanceData?.stats?.total_employees ?? 0
	const presentCount = attendanceData?.stats?.present_today ?? 0
	const absentCount = attendanceData?.stats?.absent_today ?? Math.max(totalEmployees - presentCount, 0)

	const infoItems = useMemo(
		() => [
			`${totalEmployees} staff`,
			`${presentCount} present`,
			attendanceData?.attendance_date ? `Updated ${attendanceData.attendance_date}` : 'Live overview',
		],
		[totalEmployees, presentCount, attendanceData?.attendance_date]
	)

	if (isAuthPage) {
		return <>{children}</>
	}

	return (
		<SidebarProvider>
			<DashboardSidebar
				enterpriseName={hierarchicalData?.enterprise?.name || 'EziHR'}
				attendanceDate={attendanceData?.attendance_date ?? null}
				totalEmployees={employeeCount}
				presentCount={presentCount}
				absentCount={absentCount}
				currentLevel={selectedDepartmentId ? 'department' : selectedBranchId ? 'branch' : 'enterprise'}
				selectedBranchId={selectedBranchId}
				selectedBranchName={
					selectedBranchId && hierarchicalData?.enterprise?.branches
						? hierarchicalData.enterprise.branches.find((branch) => branch.id === selectedBranchId)?.name || null
						: null
				}
				selectedDepartmentId={selectedDepartmentId}
				selectedDepartmentName={
					selectedDepartmentId
						? (hierarchicalData?.enterprise?.departments || []).find((department) => department.id === selectedDepartmentId)?.name || null
						: null
				}
				branches={hierarchicalData?.enterprise?.branches || []}
				departments={(hierarchicalData?.enterprise?.departments || []).map((department) => ({
					...department,
					branch_id: department.branch_id || undefined,
				}))}
				employees={employeeList.map((emp) => ({
					id: emp.id,
					name: emp.name,
					employee_code: emp.employee_code,
					is_admin: emp.role === 'admin',
				}))}
				onGoEnterprise={() => {
					clearFilters()
					router.push('/')
				}}
				onClearBranch={() => {
					clearFilters()
					syncSelectionToUrl(null, null)
				}}
				onClearDepartment={() => {
					clearDepartment()
					if (selectedBranchId) {
						syncSelectionToUrl(selectedBranchId, null)
						return
					}
					syncSelectionToUrl(null, null)
				}}
				onSelectBranch={(branchId) => {
					setBranch(branchId)
					clearDepartment()
					syncSelectionToUrl(branchId, null)
				}}
				onSelectDepartment={(departmentId) => {
					setDepartment(departmentId)
					syncSelectionToUrl(selectedBranchId, departmentId)
				}}
			onViewAttendance={() => {
				const params = new URLSearchParams()
				if (selectedBranchId) params.set('branch', String(selectedBranchId))
				if (selectedDepartmentId) params.set('department', String(selectedDepartmentId))
				router.push(`/attendance${params.toString() ? `?${params.toString()}` : ''}`)
			}}
			onViewStaff={() => {
				const params = new URLSearchParams()
				if (selectedBranchId) params.set('branch', String(selectedBranchId))
				if (selectedDepartmentId) params.set('department', String(selectedDepartmentId))
				router.push(`/staff${params.toString() ? `?${params.toString()}` : ''}`)
			}}
			onViewDashboard={() => {
					if (selectedDepartmentId) {
						router.push(`/dashboard/department/${selectedDepartmentId}`)
						return
					}
					if (selectedBranchId) {
						router.push(`/dashboard/branch/${selectedBranchId}`)
						return
					}
					router.push('/')
				}}
			/>

			<SidebarInset>
				<div className="min-h-screen min-w-0 overflow-x-hidden bg-zinc-50/50 dark:bg-background flex flex-col font-sans">
					<Navbar title="EziHR" subtitle="Enterprise command center" infoItems={infoItems} />
					{children}
				</div>
			</SidebarInset>

			<SidebarRight />
		</SidebarProvider>
	)
}
