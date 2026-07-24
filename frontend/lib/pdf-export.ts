import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';

type ColumnDef = {
  header: string;
  key: string;
  width?: number;
  align?: 'left' | 'center' | 'right';
};

type GeneratePdfOptions = {
  title: string;
  subtitle?: string;
  dateRange?: string;
  columns: ColumnDef[];
  data: Record<string, unknown>[];
  summary?: { label: string; value: string }[];
  filename: string;
  orientation?: 'landscape' | 'portrait';
};

const HEADER_COLOR: [number, number, number] = [30, 41, 59];
const HEADER_TEXT_COLOR: [number, number, number] = [255, 255, 255];
const ALT_ROW_COLOR: [number, number, number] = [248, 250, 252];
const BORDER_COLOR: [number, number, number] = [203, 213, 225];
const BRAND_COLOR: [number, number, number] = [59, 130, 246];

export function generatePdf({
  title,
  subtitle,
  dateRange,
  columns,
  data,
  summary,
  filename,
  orientation = 'landscape',
}: GeneratePdfOptions) {
  const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 14, right: 14, top: 14 };

  let y = margin.top;

  // Brand accent line
  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 3, 'F');
  y += 6;

  // Title
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text(title, margin.left, y);
  y += 7;

  // Subtitle
  if (subtitle) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(100, 116, 139);
    doc.text(subtitle, margin.left, y);
    y += 5;
  }

  // Date range
  if (dateRange) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${dateRange}`, margin.left, y);
    y += 4;
  }

  // Separator line
  y += 1;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.4);
  doc.line(margin.left, y, pageWidth - margin.right, y);
  y += 5;

  // Table
  const head = [columns.map((c) => c.header)];
  const body = data.map((row) =>
    columns.map((col) => {
      const val = row[col.key];
      return val === null || val === undefined ? '-' : String(val);
    })
  );

  const totalTableWidth = pageWidth - margin.left - margin.right;
  const columnStyles: Record<string, { halign: 'left' | 'center' | 'right'; cellWidth: number }> = {};
  let specifiedTotalWidth = 0;
  let unspecifiedCount = 0;

  columns.forEach((col, i) => {
    if (col.width) {
      specifiedTotalWidth += col.width;
    } else {
      unspecifiedCount++;
    }
  });

  const remainingWidth = totalTableWidth - specifiedTotalWidth;
  const defaultColWidth = unspecifiedCount > 0 ? remainingWidth / unspecifiedCount : totalTableWidth / columns.length;

  columns.forEach((col, i) => {
    columnStyles[String(i)] = {
      halign: col.align || 'left',
      cellWidth: col.width || defaultColWidth,
    };
  });

  const startY = y;

  autoTable(doc, {
    head,
    body,
    startY,
    margin: { left: margin.left, right: margin.right },
    styles: {
      fontSize: 8,
      cellPadding: 3,
      textColor: [30, 41, 59],
      lineColor: [...BORDER_COLOR],
      lineWidth: 0.2,
      overflow: 'linebreak',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [...HEADER_COLOR],
      textColor: [...HEADER_TEXT_COLOR],
      fontStyle: 'bold',
      fontSize: 8,
      cellPadding: 3.5,
    },
    alternateRowStyles: {
      fillColor: [...ALT_ROW_COLOR],
    },
    columnStyles,
    didDrawPage: (data) => {
      // Footer on every page
      const footerY = pageHeight - 8;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text('EziHR Attendance System', margin.left, footerY);
      doc.text(
        `Page ${data.pageNumber}`,
        pageWidth - margin.right,
        footerY,
        { align: 'right' }
      );
      // Top accent line on continuation pages
      doc.setFillColor(...BRAND_COLOR);
      doc.rect(0, 0, pageWidth, 3, 'F');
    },
  });

  let finalY = (doc as any).lastAutoTable?.finalY || startY;

  // Summary row
  if (summary && summary.length > 0) {
    finalY += 6;
    if (finalY > pageHeight - 30) {
      doc.addPage();
      finalY = margin.top + 6;
      doc.setFillColor(...BRAND_COLOR);
      doc.rect(0, 0, pageWidth, 3, 'F');
    }

    doc.setFillColor(248, 250, 252);
    doc.roundedRect(margin.left, finalY, totalTableWidth, 12, 1, 1, 'F');
    doc.setDrawColor(...BORDER_COLOR);
    doc.roundedRect(margin.left, finalY, totalTableWidth, 12, 1, 1, 'S');

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);

    const summaryWidth = totalTableWidth / summary.length;
    summary.forEach((item, i) => {
      const x = margin.left + i * summaryWidth;
      doc.text(item.label, x + 3, finalY + 5);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(11);
      doc.text(item.value, x + 3, finalY + 10);
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
    });
  }

  // Generation timestamp
  const tsY = finalY + 20;
  if (tsY < pageHeight - 15) {
    doc.setFontSize(7);
    doc.setTextColor(148, 163, 184);
    doc.setFont('helvetica', 'italic');
    doc.text(`Generated on ${new Date().toLocaleString()}`, margin.left, tsY);
  }

  doc.save(filename);
  return doc;
}

export function buildMonthlySummaryPdf(
  rows: any[],
  dateRange: string,
  filename: string,
  totals: { totalDays: number; presentDays: number; absentDays: number; lateDays: number; workedHours: number }
) {
  const columns: ColumnDef[] = [
    { header: 'S.N.', key: 'sn', width: 14, align: 'center' },
    { header: 'Employee', key: 'employee', width: 65 },
    { header: 'Code', key: 'code', width: 30, align: 'center' },
    { header: 'Total Days', key: 'totalDays', width: 24, align: 'center' },
    { header: 'Present', key: 'present', width: 24, align: 'center' },
    { header: 'Absent', key: 'absent', width: 24, align: 'center' },
    { header: 'Late', key: 'late', width: 24, align: 'center' },
    { header: 'Worked Hours', key: 'workedHours', width: 30, align: 'center' },
  ];

  const data = rows.map((item: any, index: number) => ({
    sn: String(index + 1),
    employee: item.employee?.name || 'Unknown',
    code: item.employee?.employee_code || '-',
    totalDays: String(item.total_days ?? '-'),
    present: String(item.present_days ?? '-'),
    absent: String(item.absent_days ?? '-'),
    late: String(item.late_days ?? '-'),
    workedHours: typeof item.worked_hours === 'number' ? item.worked_hours.toFixed(2) : '-',
  }));

  return generatePdf({
    title: 'Monthly Attendance Summary',
    dateRange,
    columns,
    data,
    filename,
    summary: [
      { label: 'Total Days', value: String(totals.totalDays) },
      { label: 'Present', value: String(totals.presentDays) },
      { label: 'Absent', value: String(totals.absentDays) },
      { label: 'Late', value: String(totals.lateDays) },
      { label: 'Worked Hours', value: totals.workedHours.toFixed(2) },
    ],
  });
}

export function buildDetailedMonthlySummaryPdf(
  rows: any[],
  dateRange: string,
  filename: string,
  reportDates: string[],
  dateFormat: 'ad' | 'bs'
) {
  const formatDayLabel = (dateValue: string) => {
    const nepaliMonths = ['Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'];
    if (dateFormat === 'bs') {
      const parts = dateValue.split('-').map((p) => Number(p));
      const [y, m, d] = parts;
      if (![y, m, d].every((v) => Number.isFinite(v))) return dateValue;
      const monthName = nepaliMonths[(m || 1) - 1] || nepaliMonths[0];
      return `${monthName} ${d}`;
    }
    const date = new Date(`${dateValue}T00:00:00`);
    if (Number.isNaN(date.getTime())) return dateValue;
    const month = new Intl.DateTimeFormat('en-US', { month: 'short' }).format(date);
    const day = new Intl.DateTimeFormat('en-US', { day: 'numeric' }).format(date);
    return `${month} ${day}`;
  };

  const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = { left: 10, right: 10, top: 14 };

  let y = margin.top;

  doc.setFillColor(...BRAND_COLOR);
  doc.rect(0, 0, pageWidth, 3, 'F');
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.setTextColor(30, 41, 59);
  doc.text('Detailed Monthly Attendance Summary', margin.left, y);
  y += 7;

  if (dateRange) {
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(100, 116, 139);
    doc.text(`Period: ${dateRange}`, margin.left, y);
    y += 4;
  }

  y += 1;
  doc.setDrawColor(...BORDER_COLOR);
  doc.setLineWidth(0.4);
  doc.line(margin.left, y, pageWidth - margin.right, y);
  y += 5;

  // For detailed summary, we have day columns (P/A/L/E) + summary columns
  const dayColumns: ColumnDef[] = reportDates.map((d, i) => ({
    header: formatDayLabel(d),
    key: `day_${i}`,
    width: Math.max(8, Math.min(14, (pageWidth - margin.left - margin.right - 100) / reportDates.length)),
    align: 'center' as const,
  }));

  const summaryColumns: ColumnDef[] = [
    { header: 'Present', key: 'present', width: 18, align: 'center' },
    { header: 'Absent', key: 'absent', width: 18, align: 'center' },
    { header: 'Late', key: 'late', width: 16, align: 'center' },
    { header: 'Hours', key: 'hours', width: 20, align: 'center' },
  ];

  const allColumns: ColumnDef[] = [
    { header: 'S.N.', key: 'sn', width: 10, align: 'center' },
    { header: 'Employee', key: 'employee', width: 50 },
    ...dayColumns,
    ...summaryColumns,
  ];

  const data = rows.map((item: any, index: number) => {
    const dayValues = (item.days || []).map((day: any) => {
      if (!day?.present) return 'A';
      if (day.late_seconds > 0) return 'L';
      if (day.early_seconds > 0) return 'E';
      return 'P';
    });

    const presentDays = dayValues.filter((v: string) => v !== 'A').length;
    const absentDays = dayValues.filter((v: string) => v === 'A').length;
    const lateDays = item.days?.filter((d: any) => Number(d?.late_seconds || 0) > 0).length || 0;
    const workedHours = item.days?.reduce((sum: number, d: any) => sum + Number(d?.worked_hours || 0), 0) || 0;

    const row: Record<string, string> = {
      sn: String(index + 1),
      employee: item.employee?.name || 'Unknown',
    };

    dayValues.forEach((v: string, i: number) => {
      row[`day_${i}`] = v;
    });

    row.present = String(presentDays);
    row.absent = String(absentDays);
    row.late = String(lateDays);
    row.hours = workedHours.toFixed(2);

    return row;
  });

  const head = [allColumns.map((c) => c.header)];
  const body = data.map((row) =>
    allColumns.map((col) => row[col.key] || '-')
  );

  let tableY = y;
  const totalTableWidth = pageWidth - margin.left - margin.right;

  autoTable(doc, {
    head,
    body,
    startY: tableY,
    margin: { left: margin.left, right: margin.right },
    styles: {
      fontSize: 7,
      cellPadding: 2,
      textColor: [30, 41, 59],
      lineColor: [...BORDER_COLOR],
      lineWidth: 0.2,
      overflow: 'linebreak',
      font: 'helvetica',
    },
    headStyles: {
      fillColor: [...HEADER_COLOR],
      textColor: [...HEADER_TEXT_COLOR],
      fontStyle: 'bold',
      fontSize: 6.5,
      cellPadding: 2,
    },
    alternateRowStyles: {
      fillColor: [...ALT_ROW_COLOR],
    },
    columnStyles: Object.fromEntries(
      allColumns.map((col, i) => [
        String(i),
        { halign: col.align || 'left', cellWidth: col.width || 12 },
      ])
    ),
    didDrawPage: (drawData) => {
      const footerY = pageHeight - 8;
      doc.setFontSize(7);
      doc.setTextColor(148, 163, 184);
      doc.setFont('helvetica', 'normal');
      doc.text('EziHR Attendance System', margin.left, footerY);
      doc.text(
        `Page ${drawData.pageNumber}`,
        pageWidth - margin.right,
        footerY,
        { align: 'right' }
      );
      doc.setFillColor(...BRAND_COLOR);
      doc.rect(0, 0, pageWidth, 3, 'F');
    },
  });

  doc.save(filename);
}

export function buildDailyAttendancePdf(
  rows: any[],
  dateRange: string,
  filename: string,
  totals: { present: number; absent: number; workedHours: number }
) {
  const formatTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatBreak = (row: any, key: 'break_out' | 'break_in') => {
    if (Array.isArray(row.break_sessions) && row.break_sessions.length > 0) {
      return row.break_sessions
        .map((s: any) => formatTime(s?.[key]))
        .filter((v: string) => v !== '-')
        .join(', ') || '-';
    }
    return formatTime(row[key]);
  };

  const columns: ColumnDef[] = [
    { header: 'S.N.', key: 'sn', width: 14, align: 'center' },
    { header: 'Employee', key: 'employee', width: 55 },
    { header: 'Status', key: 'status', width: 22, align: 'center' },
    { header: 'Check In', key: 'checkIn', width: 26, align: 'center' },
    { header: 'Check Out', key: 'checkOut', width: 26, align: 'center' },
    { header: 'Break Out', key: 'breakOut', width: 30, align: 'center' },
    { header: 'Break In', key: 'breakIn', width: 30, align: 'center' },
    { header: 'Worked Hrs', key: 'workedHrs', width: 26, align: 'center' },
  ];

  const data = rows.map((row: any, index: number) => ({
    sn: String(index + 1),
    employee: row.employee?.name || 'Unknown',
    status: row.present ? 'Present' : 'Absent',
    checkIn: formatTime(row.check_in),
    checkOut: formatTime(row.check_out),
    breakOut: formatBreak(row, 'break_out'),
    breakIn: formatBreak(row, 'break_in'),
    workedHrs: ((row.worked_minutes || 0) / 60).toFixed(2),
  }));

  return generatePdf({
    title: 'Daily Attendance Roll',
    dateRange,
    columns,
    data,
    filename,
    orientation: 'landscape',
    summary: [
      { label: 'Total', value: String(rows.length) },
      { label: 'Present', value: String(totals.present) },
      { label: 'Absent', value: String(totals.absent) },
      { label: 'Worked Hours', value: totals.workedHours.toFixed(2) },
    ],
  });
}

export function buildLateArrivalsPdf(
  rows: any[],
  dateRange: string,
  filename: string
) {
  const columns: ColumnDef[] = [
    { header: 'S.N.', key: 'sn', width: 14, align: 'center' },
    { header: 'Employee', key: 'employee', width: 55 },
    { header: 'Scheduled Time', key: 'scheduled', width: 30, align: 'center' },
    { header: 'Actual Time', key: 'actual', width: 30, align: 'center' },
    { header: 'Delay', key: 'delay', width: 22, align: 'center' },
  ];

  const data = rows.map((item: any, index: number) => ({
    sn: String(index + 1),
    employee: item.employee?.name || 'Unknown',
    scheduled: item.scheduled_arrival
      ? new Date(item.scheduled_arrival).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '-',
    actual: item.check_in
      ? new Date(item.check_in).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '-',
    delay: item.late_minutes ? `${item.late_minutes}m` : '-',
  }));

  return generatePdf({
    title: 'Late Arrivals Report',
    dateRange,
    columns,
    data,
    filename,
    orientation: 'landscape',
    summary: [{ label: 'Total Late', value: String(rows.length) }],
  });
}

export function buildEarlyDeparturesPdf(
  rows: any[],
  dateRange: string,
  filename: string
) {
  const columns: ColumnDef[] = [
    { header: 'S.N.', key: 'sn', width: 14, align: 'center' },
    { header: 'Employee', key: 'employee', width: 55 },
    { header: 'Scheduled Time', key: 'scheduled', width: 30, align: 'center' },
    { header: 'Actual Time', key: 'actual', width: 30, align: 'center' },
    { header: 'Left Early', key: 'early', width: 22, align: 'center' },
  ];

  const data = rows.map((item: any, index: number) => ({
    sn: String(index + 1),
    employee: item.employee?.name || 'Unknown',
    scheduled: item.scheduled_departure
      ? new Date(item.scheduled_departure).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '-',
    actual: item.check_out
      ? new Date(item.check_out).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : '-',
    early: item.early_minutes ? `${item.early_minutes}m` : '-',
  }));

  return generatePdf({
    title: 'Early Departures Report',
    dateRange,
    columns,
    data,
    filename,
    orientation: 'landscape',
    summary: [{ label: 'Total Early Departures', value: String(rows.length) }],
  });
}

export function buildStaffAttendancePdf(
  employeeName: string,
  employeeCode: string,
  employeeEmail: string,
  department: string,
  branch: string,
  rows: any[],
  dateRange: string,
  filename: string,
  dateFormat: 'ad' | 'bs'
) {
  const formatDate = (day: any) => {
    if (dateFormat === 'bs') return day.attendance_date_bs || day.attendance_date || '-';
    return day.attendance_date_ad || day.attendance_date || '-';
  };

  const formatTime = (value?: string | null) => {
    if (!value) return '-';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '-';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
  };

  const formatBreak = (day: any, key: 'break_in' | 'break_out') => {
    const direct = day[key];
    if (direct) return formatTime(direct);
    const vals = (day.break_sessions || [])
      .map((s: any) => s?.[key])
      .filter((v: any): v is string => Boolean(v))
      .map((v: string) => formatTime(v))
      .filter((v: string) => v !== '-');
    return vals.length === 0 ? '-' : vals.join(', ');
  };

  const formatSeconds = (sec?: number | null) => {
    const val = Number(sec || 0);
    if (!val) return '-';
    return `${(val / 60).toFixed(1)} min`;
  };

  const presentCount = rows.filter((d) => Boolean(d?.present)).length;
  const absentCount = rows.length - presentCount;
  const lateCount = rows.filter((d) => Number(d?.late_seconds || 0) > 0).length;
  const totalWorked = rows.reduce((s, d) => s + Number(d?.worked_hours || 0), 0);

  const columns: ColumnDef[] = [
    { header: 'Date', key: 'date', width: 30 },
    { header: 'Status', key: 'status', width: 22, align: 'center' },
    { header: 'Check In', key: 'checkIn', width: 26, align: 'center' },
    { header: 'Check Out', key: 'checkOut', width: 26, align: 'center' },
    { header: 'Break Out', key: 'breakOut', width: 30, align: 'center' },
    { header: 'Break In', key: 'breakIn', width: 30, align: 'center' },
    { header: 'Late By', key: 'lateBy', width: 24, align: 'center' },
    { header: 'Early By', key: 'earlyBy', width: 24, align: 'center' },
    { header: 'Worked Hrs', key: 'workedHrs', width: 26, align: 'center' },
  ];

  const data = rows.map((day: any) => ({
    date: formatDate(day),
    status: day.present ? 'Present' : 'Absent',
    checkIn: formatTime(day.first_check_in),
    checkOut: formatTime(day.last_check_out),
    breakOut: formatBreak(day, 'break_out'),
    breakIn: formatBreak(day, 'break_in'),
    lateBy: formatSeconds(day.late_seconds),
    earlyBy: formatSeconds(day.early_seconds),
    workedHrs: Number(day.worked_hours || 0).toFixed(2),
  }));

  const doc = generatePdf({
    title: `${employeeName}`,
    subtitle: `${employeeCode}  |  ${employeeEmail}  |  ${department || 'N/A'}  |  ${branch || 'N/A'}`,
    dateRange,
    columns,
    data,
    filename,
    orientation: 'landscape',
    summary: [
      { label: 'Total Days', value: String(rows.length) },
      { label: 'Present', value: String(presentCount) },
      { label: 'Absent', value: String(absentCount) },
      { label: 'Late', value: String(lateCount) },
      { label: 'Worked Hours', value: totalWorked.toFixed(2) },
    ],
  });

  return doc;
}
