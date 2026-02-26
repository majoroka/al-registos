import { useEffect, useMemo, useState } from 'react'

type DatePickerInputProps = {
  label: string
  startValue: string
  endValue: string
  onChange: (startValue: string, endValue: string) => void
  placeholder?: string
}

type CalendarDay = {
  iso: string
  label: number
  inCurrentMonth: boolean
}

const weekdayLabels = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const monthOptions = [
  { value: 0, label: 'Janeiro' },
  { value: 1, label: 'Fevereiro' },
  { value: 2, label: 'Março' },
  { value: 3, label: 'Abril' },
  { value: 4, label: 'Maio' },
  { value: 5, label: 'Junho' },
  { value: 6, label: 'Julho' },
  { value: 7, label: 'Agosto' },
  { value: 8, label: 'Setembro' },
  { value: 9, label: 'Outubro' },
  { value: 10, label: 'Novembro' },
  { value: 11, label: 'Dezembro' },
]

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

function getNextDayIso(value: string): string {
  const parsed = parseIsoDate(value)
  if (!parsed) return ''
  const next = new Date(parsed)
  next.setDate(parsed.getDate() + 1)
  return toIsoDate(next)
}

function buildCalendarDays(year: number, month: number): CalendarDay[] {
  const firstDay = new Date(year, month, 1)
  const monthStartWeekday = (firstDay.getDay() + 6) % 7
  const gridStart = new Date(year, month, 1 - monthStartWeekday)

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart)
    date.setDate(gridStart.getDate() + index)
    const iso = toIsoDate(date)

    return {
      iso,
      label: date.getDate(),
      inCurrentMonth: date.getMonth() === month,
    }
  })
}

export default function DatePickerInput({
  label,
  startValue,
  endValue,
  onChange,
  placeholder = 'Selecionar entrada e saída',
}: DatePickerInputProps) {
  const [open, setOpen] = useState(false)
  const [draftStart, setDraftStart] = useState(startValue)
  const [draftEnd, setDraftEnd] = useState(endValue)
  const [viewYear, setViewYear] = useState(new Date().getFullYear())
  const [viewMonth, setViewMonth] = useState(new Date().getMonth())
  const [yearOptions, setYearOptions] = useState<number[]>([])

  const calendarDays = useMemo(
    () => buildCalendarDays(viewYear, viewMonth),
    [viewYear, viewMonth],
  )

  useEffect(() => {
    if (!open) return

    const source = parseIsoDate(startValue) ?? parseIsoDate(endValue) ?? new Date()
    setDraftStart(startValue)
    setDraftEnd(endValue)
    setViewYear(source.getFullYear())
    setViewMonth(source.getMonth())
  }, [open, startValue, endValue])

  useEffect(() => {
    const current = new Date().getFullYear()
    const startYear = 2000
    const endYear = current + 5
    const years = Array.from({ length: endYear - startYear + 1 }, (_, index) => startYear + index)
    setYearOptions(years.reverse())
  }, [])

  const moveMonth = (offset: number) => {
    const next = new Date(viewYear, viewMonth + offset, 1)
    setViewYear(next.getFullYear())
    setViewMonth(next.getMonth())
  }

  const handleConfirm = () => {
    onChange(draftStart, draftEnd)
    setOpen(false)
  }

  const handleCancel = () => {
    setDraftStart(startValue)
    setDraftEnd(endValue)
    setOpen(false)
  }

  const handlePickDay = (iso: string) => {
    if (!draftStart || (draftStart && draftEnd)) {
      setDraftStart(iso)
      setDraftEnd('')
      return
    }

    if (iso <= draftStart) {
      setDraftStart(iso)
      setDraftEnd('')
      return
    }

    setDraftEnd(iso)
  }

  const handleManualStartChange = (value: string) => {
    setDraftStart(value)
    if (!value) {
      setDraftEnd('')
      return
    }
    if (draftEnd && draftEnd <= value) {
      setDraftEnd('')
    }
  }

  const handleManualEndChange = (value: string) => {
    if (!value) {
      setDraftEnd('')
      return
    }
    if (draftStart && value <= draftStart) return
    setDraftEnd(value)
  }

  const hasCompleteRange = !!draftStart && !!draftEnd
  const summaryText = hasCompleteRange
    ? `${formatDisplayDate(draftStart)} → ${formatDisplayDate(draftEnd)}`
    : draftStart
      ? `${formatDisplayDate(draftStart)} → ...`
      : placeholder

  return (
    <>
      <label>
        {label}
        <button
          type="button"
          className={`date-input-trigger ${hasCompleteRange ? 'has-value' : ''}`}
          onClick={() => setOpen(true)}
          aria-haspopup="dialog"
          aria-expanded={open}
        >
          <span>{summaryText}</span>
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
              <div className="date-picker-period">
                <select
                  className="date-picker-select"
                  value={viewMonth}
                  onChange={(event) => setViewMonth(Number.parseInt(event.target.value, 10))}
                >
                  {monthOptions.map((option) => (
                    <option key={option.label} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <select
                  className="date-picker-select"
                  value={viewYear}
                  onChange={(event) => setViewYear(Number.parseInt(event.target.value, 10))}
                >
                  {yearOptions.map((yearOption) => (
                    <option key={yearOption} value={yearOption}>
                      {yearOption}
                    </option>
                  ))}
                </select>
              </div>
              <button type="button" className="date-picker-nav" onClick={() => moveMonth(1)}>
                ›
              </button>
            </div>

            <div className="date-picker-manual">
              <label>
                Entrada
                <input
                  type="date"
                  value={draftStart}
                  onChange={(event) => handleManualStartChange(event.target.value)}
                />
              </label>
              <label>
                Saída
                <input
                  type="date"
                  value={draftEnd}
                  min={getNextDayIso(draftStart)}
                  onChange={(event) => handleManualEndChange(event.target.value)}
                />
              </label>
            </div>

            <div className="date-picker-weekdays">
              {weekdayLabels.map((weekday) => (
                <span key={weekday}>{weekday}</span>
              ))}
            </div>

            <div className="date-picker-grid">
              {calendarDays.map((day) => {
                const isStart = draftStart === day.iso
                const isEnd = draftEnd === day.iso
                const inRange =
                  !!draftStart && !!draftEnd && day.iso > draftStart && day.iso < draftEnd
                return (
                  <button
                    key={day.iso}
                    type="button"
                    className={`date-day ${day.inCurrentMonth ? '' : 'outside'} ${
                      isStart ? 'range-start selected' : ''
                    } ${isEnd ? 'range-end selected' : ''} ${inRange ? 'in-range' : ''}
                    ${
                      !day.inCurrentMonth && (isStart || isEnd || inRange)
                        ? 'outside-highlight'
                        : ''
                    }`}
                    onClick={() => handlePickDay(day.iso)}
                  >
                    {day.label}
                  </button>
                )
              })}
            </div>

            <div className="date-picker-actions">
              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setDraftStart('')
                  setDraftEnd('')
                }}
              >
                Limpar
              </button>
              <button type="button" className="secondary" onClick={handleCancel}>
                Cancelar
              </button>
              <button type="button" onClick={handleConfirm} disabled={!hasCompleteRange}>
                OK
              </button>
            </div>
          </section>
        </div>
      )}
    </>
  )
}
