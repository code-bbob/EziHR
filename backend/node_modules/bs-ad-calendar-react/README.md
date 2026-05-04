# BS-AD Calendar

A modern React calendar component for seamless conversion between **Bikram Sambat (BS)** and **Gregorian (AD)** calendars. Supports date picker, range selector, Nepali localization, and full theme customization.

[![npm version](https://img.shields.io/npm/v/bs-ad-calendar-react.svg)](https://www.npmjs.com/package/bs-ad-calendar-react)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)

## Live Demo

[View Demo](https://bibekamatya.github.io/bs-ad-calendar/)

## Key Feature

**Select any date → Get both BS and AD dates automatically**

```
Input:  Click Poush 15, 2081 (BS)
Output: { bs: "2081-09-15", ad: "2024-12-31", formatted: { bs: "Poush 15, 2081", ad: "December 31, 2024" } }
```

## Features

- ✅ Automatic BS ↔ AD dual calendar conversion
- ✅ Single date and range selection
- ✅ Range selector with preset shortcuts (Last 7 days, This month, etc.)
- ✅ DatePicker input component
- ✅ Default value support
- ✅ Nepali localization (months, days, numbers)
- ✅ Full CSS variable theming (dark mode support)
- ✅ Custom colors via `colors` prop
- ✅ Date constraints (minDate / maxDate)
- ✅ Keyboard navigation
- ✅ TypeScript support
- ✅ Accessible (ARIA labels)
- ✅ Responsive design

## Installation

```bash
npm install bs-ad-calendar-react
```

## Examples

### Basic Calendar

```tsx
import { Calendar } from 'bs-ad-calendar-react'

export default function App() {
  return (
    <Calendar
      calendarType="BS"
      onDateSelect={(date) => console.log(date)}
    />
  )
}
```

**Output:**
```json
{
  "bs": "2081-09-15",
  "ad": "2024-12-31",
  "formatted": {
    "bs": "Poush 15, 2081",
    "ad": "December 31, 2024"
  }
}
```

### Range Selector

```tsx
<Calendar
  calendarType="BS"
  mode="range"
  showRangePresets
  onRangeSelect={(range) => console.log(range)}
/>
```

**Output:**
```json
{
  "start": { "bs": "2081-09-01", "ad": "2024-12-17", "formatted": { "bs": "Poush 1, 2081", "ad": "December 17, 2024" } },
  "end":   { "bs": "2081-09-30", "ad": "2025-01-14", "formatted": { "bs": "Poush 30, 2081", "ad": "January 14, 2025" } }
}
```

### Range Selector with Preset Shortcuts

```tsx
import { Calendar, PRESET_KEYS } from 'bs-ad-calendar-react'

<Calendar
  calendarType="BS"
  mode="range"
  showRangePresets
  rangePresetsPosition="left"
  presetKeys={[
    PRESET_KEYS.TODAY,
    PRESET_KEYS.LAST_7_DAYS,
    PRESET_KEYS.LAST_30_DAYS,
    PRESET_KEYS.THIS_MONTH,
    PRESET_KEYS.LAST_MONTH,
    PRESET_KEYS.LAST_3_MONTHS,
    PRESET_KEYS.LAST_YEAR,
  ]}
  onRangeSelect={(range) => console.log(range)}
/>
```

### Custom Preset Labels

```tsx
<Calendar
  calendarType="BS"
  mode="range"
  showRangePresets
  presetKeys={[PRESET_KEYS.LAST_7_DAYS, PRESET_KEYS.THIS_MONTH]}
  presetLabels={{
    [PRESET_KEYS.LAST_7_DAYS]: 'पछिल्लो ७ दिन',
    [PRESET_KEYS.THIS_MONTH]: 'यो महिना'
  }}
  onRangeSelect={(range) => console.log(range)}
/>
```

### DatePicker Input

```tsx
import { DatePicker } from 'bs-ad-calendar-react'

const today = new Date().toISOString().split('T')[0]

export default function App() {
  return (
    <DatePicker
      calendarType="BS"
      placeholder="Select a date"
      defaultValue={today}
      onDateSelect={(date) => console.log(date)}
    />
  )
}
```

### Nepali Localization

```tsx
<Calendar
  calendarType="BS"
  showNepaliMonths
  showNepaliDays
  showNepaliNumbers
  onDateSelect={(date) => console.log(date)}
/>
```

### Custom Colors

```tsx
<Calendar
  calendarType="BS"
  colors={{
    primary: '#10b981',
    selected: '#059669',
    today: '#d1fae5',
    hover: '#f0fdf4',
    background: '#ffffff',
    text: '#1f2937',
    border: '#e5e7eb',
    disabled: '#d1d5db',
  }}
  onDateSelect={(date) => console.log(date)}
/>
```

### Dark Theme via CSS Variables

```css
/* In your global CSS */
:root {
  --calendar-background: #1e293b;
  --calendar-text: #f1f5f9;
  --calendar-border: #334155;
  --calendar-hover: #334155;
  --calendar-selected: #3b82f6;
  --calendar-today: #1e40af;
  --calendar-primary: #60a5fa;
  --calendar-disabled: #475569;

  /* Range presets */
  --presets-background: #1e293b;
  --presets-border: #334155;
  --preset-btn-background: #0f172a;
  --preset-btn-text: #94a3b8;
  --preset-btn-active-background: #3b82f6;

  /* DatePicker input */
  --datepicker-background: #0f172a;
  --datepicker-text: #ffffff;
  --datepicker-border: #334155;
}
```

### Date Constraints

```tsx
<Calendar
  calendarType="AD"
  minDate="2024-01-01"
  maxDate="2025-12-31"
  onDateSelect={(date) => console.log(date)}
/>
```

## API Reference

### Calendar Props

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `calendarType` | `'BS' \| 'AD'` | `'AD'` | Calendar type |
| `mode` | `'single' \| 'range'` | `'single'` | Selection mode |
| `onDateSelect` | `(date: DateOutput) => void` | - | Single date callback |
| `onRangeSelect` | `(range: DateRangeOutput) => void` | - | Range callback |
| `showToday` | `boolean` | `true` | Highlight today |
| `disabled` | `boolean` | `false` | Disable interaction |
| `minDate` | `string` | - | Min selectable date (YYYY-MM-DD) |
| `maxDate` | `string` | - | Max selectable date (YYYY-MM-DD) |
| `colors` | `ColorConfig` | - | Custom colors |
| `showNepaliMonths` | `boolean` | `false` | Nepali month names |
| `showNepaliDays` | `boolean` | `false` | Nepali day names |
| `showNepaliNumbers` | `boolean` | `false` | Nepali digits |
| `showRangePresets` | `boolean` | `false` | Show preset shortcuts |
| `rangePresetsPosition` | `'top' \| 'right' \| 'bottom' \| 'left'` | `'top'` | Preset position |
| `presetKeys` | `string[]` | - | Filter which presets to show |
| `presetLabels` | `Record<string, string>` | - | Rename preset labels |
| `predefinedRanges` | `PredefinedRange[]` | - | Custom presets |

### DatePicker Props

Extends Calendar props plus:

| Prop | Type | Default | Description |
|------|------|---------|-------------|
| `placeholder` | `string` | `'Select date'` | Input placeholder |
| `defaultValue` | `string` | - | Initial date (AD ISO: YYYY-MM-DD) |
| `inputClassName` | `string` | - | Input element CSS class |
| `popupClassName` | `string` | - | Popup container CSS class |

### Output Format

```tsx
// DateOutput (onDateSelect)
{
  bs: "2081-09-15",
  ad: "2024-12-31",
  formatted: {
    bs: "Poush 15, 2081",
    ad: "December 31, 2024"
  }
}

// DateRangeOutput (onRangeSelect)
{
  start: DateOutput,
  end: DateOutput
}
```

## CSS Variables Reference

| Variable | Description |
|----------|-------------|
| `--calendar-background` | Calendar background |
| `--calendar-text` | Text color |
| `--calendar-border` | Border color |
| `--calendar-hover` | Day hover background |
| `--calendar-selected` | Selected day background |
| `--calendar-today` | Today highlight background |
| `--calendar-primary` | Primary color (today text, range text) |
| `--calendar-disabled` | Disabled day color |
| `--presets-background` | Presets container background |
| `--presets-border` | Presets container border |
| `--preset-btn-background` | Preset button background |
| `--preset-btn-text` | Preset button text |
| `--preset-btn-active-background` | Active preset background |
| `--datepicker-background` | Input background |
| `--datepicker-text` | Input text color |
| `--datepicker-border` | Input border color |
| `--datepicker-border-focus` | Input focus border |
| `--datepicker-icon` | Calendar icon color |

## Available Preset Keys

```tsx
PRESET_KEYS.TODAY           // Today
PRESET_KEYS.YESTERDAY       // Yesterday
PRESET_KEYS.THIS_WEEK       // This Week
PRESET_KEYS.LAST_7_DAYS     // Last 7 Days
PRESET_KEYS.LAST_30_DAYS    // Last 30 Days
PRESET_KEYS.THIS_MONTH      // This Month
PRESET_KEYS.LAST_MONTH      // Last Month
PRESET_KEYS.LAST_3_MONTHS   // Last 3 Months
PRESET_KEYS.LAST_6_MONTHS   // Last 6 Months
PRESET_KEYS.LAST_9_MONTHS   // Last 9 Months
PRESET_KEYS.LAST_180_DAYS   // Last 180 Days
PRESET_KEYS.LAST_YEAR       // Last Year (12 months)
```

## Keyboard Navigation

| Key | Action |
|-----|--------|
| `Arrow Left / Right` | Navigate months |
| `Arrow Up / Down` | Navigate years |
| `PageUp / PageDown` | Navigate months |
| `Shift + PageUp / PageDown` | Navigate years |

## TypeScript

```tsx
import type { DateOutput, DateRangeOutput, CalendarProps, DatePickerProps } from 'bs-ad-calendar-react'
import { Calendar, DatePicker, PRESET_KEYS } from 'bs-ad-calendar-react'
```

## Browser Support

Chrome, Firefox, Safari, Edge (latest versions)

## License

MIT © [Bibek Amatya](https://github.com/bibekamatya)

## Links

- [GitHub](https://github.com/bibekamatya/bs-ad-calendar)
- [NPM](https://www.npmjs.com/package/bs-ad-calendar-react)
- [Demo](https://bibekamatya.github.io/bs-ad-calendar/)
- [Report Issues](https://github.com/bibekamatya/bs-ad-calendar/issues)
