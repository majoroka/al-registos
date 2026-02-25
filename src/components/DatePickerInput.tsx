import { useEffect, useMemo, useState } from 'react'

type DatePickerInputProps = {
  label: string
  value: string
  onChange: (value: string) => void
  placeholder?: string
  min?: string
  max?: string
}

type CalendarDay = {
  iso: string
  label: number
  inCurrentMonth: boolean
  disabled: boolean
}

const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']

function parseIsoDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [yearRaw, monthRaw, dayRaw] = value.split('-')
  const year = Number.parseInt(yearRaw, 10)
  const month = Number.parseInt(monthRaw, 10)
  const day = Number.parseInt(dayRaw, 10)

  if (!Number.isInteger(year) || !Number.isInteger(month) || !Number.isInteger(day)) {
    return null
  }

  const parsed = new Date(year, month - 1, day)
  if (
    parsed.getFullYear() !== year ||
    parsed.getMonth() !== month - 1 ||
    parsed.getDate() !== day
  ) {
    return null
  }

  return parsed
}

function toIsoDate(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function formatDisplayDate(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return value

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function buildCalendarDays(year: number, month: number, min?: string, max?: string): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const monthStartWeekday = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - monthStartWeekday)
  const minDate = min ? parseIsoDate(min) : null
  const maxDate = max ? parseIsoDate(max) : null

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const iso = toIsoDate(date)
    const isBeforeMin = minDate ? date < minDate : false
    const isAfterMax = maxDate ? date > maxDate : false

    return {
      iso,
      label: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
      disabled: isBeforeMin || isAfterMax,
    }
  })
}

export default function DatePickerInput({
  label,
  value,
  onChange,
  placeholder = 'Selecionar data',
  min,
  max,
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false)
  const [draftValue, setDraftValue] = useState(value)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())

  const monthLabel = useMemo(
    () => {
      const monthName = new Intl.DateTimeFormat('pt-PT', { month: 'long' }).format(
        new Date(viewYear, viewMonth, 1),
      )
      return `${monthName} ${viewYear}`
    },
    [viewYear, viewMonth],
  )

  const calendarDays = useMemo(
    () => buildCalendarDays(viewYear, viewMonth, min, max),
    [viewYear, viewMonth, min, max],
  )

  useEffect(() => {
    if (!open) return

    const source = parseIsoDate(value) ?? parseIsoDate(min ?? '') ?? new Date()
    setDraftValue(value)
    setViewYear(source.getFullYear())
    setViewMonth(source.getMonth())
  }, [open, value, min])

  const moveMonth = (offset: number) => {
    const next = new Date(viewYear, viewMonth + offset, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const handleConfirm = () => {
    onChange(draftValue)
    setOpen(false)
  }

  const handleCancel = () => {
    setDraftValue(value)
    setOpen(false)
  }

  return (
    <>
      <label>
        {label}
        <button
          type="button"
          className={`date-input-trigger ${value ? 'has-value' : ''}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>{value ? formatDisplayDate(value) : placeholder}</span>
          <span className="date-input-icon" aria-hidden>
            ▼
          </span>
        </button>
      </label>

      {open && (
        <div className="date-picker-backdrop" onClick={handleCancel}>
          <section
            className="date-picker-dialog"
            role="dialog"
            aria-modal="true"
            aria-label={`Selecionar data para ${label}`}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="date-picker-header">
              <button type="button" className="date-picker-nav" onClick={() => moveMonth(-1)}>
                ‹
              </button>
              <strong>{monthLabel}</strong>
              <button type="button" className="date-picker-nav" onClick={() => moveMonth(1)}>
                ›
              </button>
            </div>

            <div className="date-picker-weekdays">
              {weekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="date-picker-grid">
              {calendarDays.map((day) => {
                const selected = draftValue === day.iso
                return (
                  <button
                    key={day.iso}
                    type="button"
                    className={`date-day ${day.inCurrentMonth ? '' : 'outside'} ${
                      selected ? 'selected' : ''
                    }`}
                    disabled={day.disabled}
                    onClick={() => setDraftValue(day.iso)}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>

            <div className="date-picker-actions">
              <button type="button" className="secondary" onClick={() => setDraftValue('')}>
                Limpar
              </button>
              <button type="button" className="secondary" onClick={handleCancel}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm}>
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
