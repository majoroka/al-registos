import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'
import DatePickerInput from '../components/DatePickerInput'
import { listApartments } from '../data/apartments'
import { createStay, deleteStay, listStays, updateStay } from '../data/stays'
import { logError, toPublicErrorMessage } from '../lib/errors'
import type { Apartment, StayInput, StayWithApartment } from '../types'

type StayEditorMode = 'create' | 'edit' | null

type GuestForm = {
  guest_name: string
  guest_phone: string
  guest_email: string
  guest_address: string
  people_count: string
  linen: string
  notes: string
  check_in: string
  check_out: string
}

type ConsultFilters = {
  apartmentId: string
  year: string
  month: string
}

type PanelMode = 'consult' | 'export'

type ParsedFilters = {
  apartmentId: number | null
  year: number | null
  month: number | null
}

type ExportMonthGroup = {
  month: number
  stays: StayWithApartment[]
}

type ExportYearGroup = {
  year: number
  months: ExportMonthGroup[]
}

type ExportOutputMode = 'pdf' | 'print'

type PendingPdfExport = {
  stays: StayWithApartment[]
  year: number
  month: number
  apartmentLabel: string
}

const currentYear = new Date().getFullYear()
const minYear = 2000
const maxYear = currentYear + 1
const filterMinYear = 2015
const filterMaxYear = currentYear
const monthOptions = [
  { value: '1', label: 'Janeiro' },
  { value: '2', label: 'Fevereiro' },
  { value: '3', label: 'Março' },
  { value: '4', label: 'Abril' },
  { value: '5', label: 'Maio' },
  { value: '6', label: 'Junho' },
  { value: '7', label: 'Julho' },
  { value: '8', label: 'Agosto' },
  { value: '9', label: 'Setembro' },
  { value: '10', label: 'Outubro' },
  { value: '11', label: 'Novembro' },
  { value: '12', label: 'Dezembro' },
]
const apartmentCardLicenseByName: Record<string, string> = {
  'T1 - Tropical': '8168/AL',
  'T2 - Caravela': '4668/AL',
}

const emptyForm: GuestForm = {
  guest_name: '',
  guest_phone: '',
  guest_email: '',
  guest_address: '',
  people_count: '1',
  linen: 'Com Roupa',
  notes: '',
  check_in: '',
  check_out: '',
}

const yearFilterOptions = Array.from(
  { length: filterMaxYear - filterMinYear + 1 },
  (_, index) => String(filterMinYear + index),
).reverse()

const monthLabelByValue = Object.fromEntries(monthOptions.map((option) => [option.value, option.label]))

function parsePositiveInteger(value: string): number | null {
  const trimmed = value.trim()
  if (!/^\d+$/.test(trimmed)) return null

  const parsed = Number(trimmed)
  if (!Number.isSafeInteger(parsed) || parsed <= 0) return null
  return parsed
}

function parseYear(value: string): number | null {
  const parsed = parsePositiveInteger(value)
  if (!parsed || parsed < minYear || parsed > maxYear) return null
  return parsed
}

function calculateNights(checkIn: string, checkOut: string): number | null {
  if (!checkIn || !checkOut) return null

  const start = new Date(`${checkIn}T00:00:00`)
  const end = new Date(`${checkOut}T00:00:00`)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return null

  const diffMs = end.getTime() - start.getTime()
  const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24))
  if (diffDays <= 0) return null

  return diffDays
}

function parseDateSafe(value: string | null | undefined): Date | null {
  if (!value) return null
  const parsed = new Date(`${value}T00:00:00`)
  if (Number.isNaN(parsed.getTime())) return null
  return parsed
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function getStayInterval(stay: StayWithApartment): { start: Date; end: Date } | null {
  const start = parseDateSafe(stay.check_in)
  const end = parseDateSafe(stay.check_out)

  if (start && end && end > start) {
    return { start, end }
  }

  if (start) {
    const inferredNights = Number.isFinite(stay.nights_count) ? Math.max(1, stay.nights_count) : 1
    return {
      start,
      end: addDays(start, inferredNights),
    }
  }

  if (end) {
    return {
      start: addDays(end, -1),
      end,
    }
  }

  return null
}

function intervalOverlaps(
  intervalStart: Date,
  intervalEnd: Date,
  filterStart: Date,
  filterEnd: Date,
): boolean {
  return intervalStart < filterEnd && intervalEnd > filterStart
}

function includesMonth(interval: { start: Date; end: Date }, month: number): boolean {
  const cursor = new Date(interval.start.getFullYear(), interval.start.getMonth(), 1)
  while (cursor < interval.end) {
    if (cursor.getMonth() + 1 === month) return true
    cursor.setMonth(cursor.getMonth() + 1)
  }
  return false
}

function getStayRecencyScore(stay: StayWithApartment): number {
  const checkInDate = parseDateSafe(stay.check_in)
  if (checkInDate) return checkInDate.getTime()

  const checkOutDate = parseDateSafe(stay.check_out)
  if (checkOutDate) return checkOutDate.getTime()

  return new Date(stay.year, 11, 31).getTime()
}

function toGuestForm(stay: StayWithApartment): GuestForm {
  return {
    guest_name: stay.guest_name,
    guest_phone: stay.guest_phone,
    guest_email: stay.guest_email,
    guest_address: stay.guest_address,
    people_count: stay.people_count >= 10 ? '10' : String(stay.people_count),
    linen: stay.linen === 'Sem Roupa' ? 'Sem Roupa' : 'Com Roupa',
    notes: stay.notes ?? '',
    check_in: stay.check_in ?? '',
    check_out: stay.check_out ?? '',
  }
}

function toDuplicateGuestForm(stay: StayWithApartment): GuestForm {
  const source = toGuestForm(stay)
  return {
    ...source,
    check_in: '',
    check_out: '',
  }
}

function formatDateForDisplay(value: string | null | undefined): string {
  const parsed = parseDateSafe(value)
  if (!parsed) return '-'

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(parsed)
}

function formatDateForPdf(value: string | null | undefined): string {
  const parsed = parseDateSafe(value)
  if (!parsed) return '-'

  return new Intl.DateTimeFormat('pt-PT', {
    day: '2-digit',
    month: 'long',
    year: 'numeric',
  }).format(parsed)
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}

function toFileNameSegment(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase()
}

function buildExportFileName(apartmentLabel: string, month: number, year: number): string {
  const monthLabel = monthLabelByValue[String(month)] ?? `mes-${month}`
  return `registos-${toFileNameSegment(apartmentLabel || 'todos')}-${toFileNameSegment(monthLabel)}-${year}.pdf`
}

async function buildPdfBlobFromHtml(html: string): Promise<Blob> {
  const iframe = document.createElement('iframe')
  iframe.setAttribute('aria-hidden', 'true')
  iframe.style.position = 'fixed'
  iframe.style.right = '-10000px'
  iframe.style.bottom = '-10000px'
  iframe.style.width = '794px'
  iframe.style.height = '1123px'
  iframe.style.opacity = '0'
  iframe.style.pointerEvents = 'none'
  document.body.appendChild(iframe)

  try {
    const targetWindow = iframe.contentWindow
    const targetDocument = iframe.contentDocument
    if (!targetWindow || !targetDocument) {
      throw new Error('Não foi possível preparar a área de renderização do PDF.')
    }

    targetDocument.open()
    targetDocument.write(html)
    targetDocument.close()

    await new Promise<void>((resolve) => {
      targetWindow.addEventListener('load', () => resolve(), { once: true })
      setTimeout(() => resolve(), 220)
    })

    const sheet = targetDocument.querySelector<HTMLElement>('.sheet')
    if (!sheet) {
      throw new Error('Estrutura de exportação inválida.')
    }

    const canvas = await html2canvas(sheet, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
      windowWidth: Math.max(targetDocument.body.scrollWidth, 794),
      windowHeight: Math.max(targetDocument.body.scrollHeight, 1123),
    })

    const pdf = new jsPDF({
      orientation: 'portrait',
      unit: 'mm',
      format: 'a4',
      compress: true,
    })
    const pageWidth = pdf.internal.pageSize.getWidth()
    const pageHeight = pdf.internal.pageSize.getHeight()
    const marginX = 5
    const marginY = 5
    const usableWidth = pageWidth - marginX * 2
    const usableHeight = pageHeight - marginY * 2
    const ratio = Math.min(usableWidth / canvas.width, usableHeight / canvas.height)
    const renderWidth = canvas.width * ratio
    const renderHeight = canvas.height * ratio
    const offsetX = (pageWidth - renderWidth) / 2
    const offsetY = marginY

    pdf.addImage(canvas.toDataURL('image/png'), 'PNG', offsetX, offsetY, renderWidth, renderHeight)
    return pdf.output('blob')
  } finally {
    iframe.remove()
  }
}

async function savePdfBlob(blob: Blob, fileName: string): Promise<'picker' | 'download'> {
  type SavePickerWindow = Window & {
    showSaveFilePicker?: (options: {
      suggestedName: string
      types: Array<{
        description: string
        accept: Record<string, string[]>
      }>
      excludeAcceptAllOption?: boolean
    }) => Promise<{
      createWritable: () => Promise<{
        write: (data: Blob) => Promise<void>
        close: () => Promise<void>
      }>
    }>
  }

  const pickerWindow = window as SavePickerWindow
  if (typeof pickerWindow.showSaveFilePicker === 'function') {
    const handle = await pickerWindow.showSaveFilePicker({
      suggestedName: fileName,
      excludeAcceptAllOption: true,
      types: [
        {
          description: 'PDF',
          accept: { 'application/pdf': ['.pdf'] },
        },
      ],
    })
    const writable = await handle.createWritable()
    await writable.write(blob)
    await writable.close()
    return 'picker'
  }

  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 8_000)
  return 'download'
}

function validateGuestForm(
  form: GuestForm,
  apartmentId: number,
): { payload: StayInput } | { error: string } {
  const guestName = form.guest_name.trim()
  const guestPhone = form.guest_phone.trim()
  const guestEmail = form.guest_email.trim().toLowerCase()
  const guestAddress = form.guest_address.trim()
  const peopleCount = parsePositiveInteger(form.people_count)
  const checkIn = form.check_in
  const checkOut = form.check_out
  const nightsCount = calculateNights(checkIn, checkOut)
  const checkInYear = checkIn ? Number(checkIn.slice(0, 4)) : null
  const year = checkInYear ? parseYear(String(checkInYear)) : null

  if (guestName.length < 2) {
    return { error: 'O nome do hóspede é obrigatório.' }
  }

  if (!/^[0-9+()\-\s]{6,20}$/.test(guestPhone)) {
    return { error: 'Telefone inválido.' }
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(guestEmail)) {
    return { error: 'Email inválido.' }
  }

  if (guestAddress.length < 3) {
    return { error: 'A morada é obrigatória.' }
  }

  if (!peopleCount) {
    return { error: 'Número de pessoas inválido.' }
  }

  if (!checkIn || !checkOut) {
    return { error: 'Preenche check-in e check-out.' }
  }

  if (!nightsCount) {
    return { error: 'Check-out deve ser posterior ao check-in.' }
  }

  if (!year) {
    return { error: `Ano de check-in inválido. Usa um valor entre ${minYear} e ${maxYear}.` }
  }

  if (form.linen !== 'Com Roupa' && form.linen !== 'Sem Roupa') {
    return { error: 'Seleciona uma opção válida de roupa.' }
  }

  return {
    payload: {
      guest_name: guestName,
      guest_phone: guestPhone,
      guest_email: guestEmail,
      guest_address: guestAddress,
      apartment_id: apartmentId,
      people_count: peopleCount,
      nights_count: nightsCount,
      linen: form.linen,
      rating: null,
      notes: form.notes.trim() || null,
      year,
      check_in: checkIn,
      check_out: checkOut,
    },
  }
}

function parseFilters(filters: ConsultFilters): { parsed?: ParsedFilters; error?: string } {
  const apartmentId = filters.apartmentId ? Number.parseInt(filters.apartmentId, 10) : null
  const year = filters.year ? Number.parseInt(filters.year, 10) : null
  const month = filters.month ? Number.parseInt(filters.month, 10) : null

  if (filters.apartmentId && (!apartmentId || apartmentId <= 0)) {
    return { error: 'Apartamento inválido.' }
  }

  if (filters.year && (!year || year < filterMinYear || year > filterMaxYear)) {
    return { error: `Ano inválido. Usa um valor entre ${filterMinYear} e ${filterMaxYear}.` }
  }

  if (filters.month && (!month || month < 1 || month > 12)) {
    return { error: 'Mês inválido.' }
  }

  return {
    parsed: {
      apartmentId,
      year,
      month,
    },
  }
}

function sortStaysByRecency(stays: StayWithApartment[]): StayWithApartment[] {
  return [...stays].sort((left, right) => {
    const scoreDiff = getStayRecencyScore(right) - getStayRecencyScore(left)
    if (scoreDiff !== 0) return scoreDiff
    return right.id - left.id
  })
}

function filterStaysByFilters(stays: StayWithApartment[], filters: ParsedFilters): StayWithApartment[] {
  const { year, month } = filters

  if (year === null && month === null) {
    return sortStaysByRecency(stays)
  }

  const yearStart = year !== null ? new Date(year, 0, 1) : null
  const yearEnd = year !== null ? new Date(year + 1, 0, 1) : null
  const monthStart = year !== null && month !== null ? new Date(year, month - 1, 1) : null
  const monthEnd = year !== null && month !== null ? new Date(year, month, 1) : null

  const filtered = stays.filter((stay) => {
    const interval = getStayInterval(stay)

    if (year !== null && month !== null) {
      if (!interval || !monthStart || !monthEnd) return false
      return intervalOverlaps(interval.start, interval.end, monthStart, monthEnd)
    }

    if (year !== null) {
      if (!interval || !yearStart || !yearEnd) {
        return stay.year === year
      }
      return intervalOverlaps(interval.start, interval.end, yearStart, yearEnd)
    }

    if (month !== null) {
      if (!interval) return false
      return includesMonth(interval, month)
    }

    return true
  })

  return sortStaysByRecency(filtered)
}

function groupStaysForExport(
  stays: StayWithApartment[],
  filters: ParsedFilters,
): ExportYearGroup[] {
  const forcedYear = filters.year
  const forcedMonth = filters.month
  const yearMap = new Map<number, Map<number, StayWithApartment[]>>()

  for (const stay of stays) {
    const interval = getStayInterval(stay)
    const anchorDate =
      interval?.start ?? parseDateSafe(stay.check_out) ?? new Date(stay.year, 0, 1)
    const year = forcedYear ?? anchorDate.getFullYear()
    const month = forcedMonth ?? anchorDate.getMonth() + 1

    if (!yearMap.has(year)) {
      yearMap.set(year, new Map<number, StayWithApartment[]>())
    }
    const monthMap = yearMap.get(year)!
    if (!monthMap.has(month)) {
      monthMap.set(month, [])
    }
    monthMap.get(month)!.push(stay)
  }

  return Array.from(yearMap.entries())
    .sort((left, right) => right[0] - left[0])
    .map(([year, monthMap]) => ({
      year,
      months: Array.from(monthMap.entries())
        .sort((left, right) => right[0] - left[0])
        .map(([month, monthStays]) => ({
          month,
          stays: sortStaysByRecency(monthStays),
        })),
    }))
}

function buildReservedDaysSet(stays: StayWithApartment[], year: number, month: number): Set<number> {
  const reservedDays = new Set<number>()
  const monthStart = new Date(year, month - 1, 1)
  const monthEnd = new Date(year, month, 1)

  for (const stay of stays) {
    const interval = getStayInterval(stay)
    if (!interval) continue
    if (!intervalOverlaps(interval.start, interval.end, monthStart, monthEnd)) continue

    const overlapStart = interval.start > monthStart ? interval.start : monthStart
    const overlapEnd = interval.end < monthEnd ? interval.end : monthEnd
    const cursor = new Date(overlapStart)

    while (cursor < overlapEnd) {
      reservedDays.add(cursor.getDate())
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  return reservedDays
}

function buildExportDocumentHtml(params: {
  stays: StayWithApartment[]
  year: number
  month: number
  apartmentLabel: string
  outputMode: ExportOutputMode
}): string {
  const { stays, year, month, apartmentLabel, outputMode } = params
  const monthLabel = monthLabelByValue[String(month)] ?? `Mês ${month}`
  const reservedDays = buildReservedDaysSet(stays, year, month)
  const monthStartWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const daysInMonth = new Date(year, month, 0).getDate()
  const weekdayHeaders = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
  const totalCells = 42

  const calendarCells = Array.from({ length: totalCells }, (_, index) => {
    const dayNumber = index - monthStartWeekday + 1
    if (dayNumber < 1 || dayNumber > daysInMonth) {
      return '<td class="day empty"></td>'
    }
    const reservedClass = reservedDays.has(dayNumber) ? ' reserved' : ''
    return `<td class="day${reservedClass}">${dayNumber}</td>`
  })

  const calendarRows = Array.from({ length: 6 }, (_, rowIndex) => {
    const start = rowIndex * 7
    return `<tr>${calendarCells.slice(start, start + 7).join('')}</tr>`
  }).join('')

  const rowsHtml = stays
    .map((stay) => {
      const nights = calculateNights(stay.check_in ?? '', stay.check_out ?? '') ?? stay.nights_count
      const notes = stay.notes?.trim() ? stay.notes : '-'

      return `
        <article class="record">
          <h3 class="record-name">${escapeHtml(stay.guest_name)}</h3>
          <div class="record-dates">
            <p class="record-entry"><strong>Entrada:</strong> ${escapeHtml(formatDateForPdf(stay.check_in))}</p>
            <p class="record-exit"><strong>Saída:</strong> ${escapeHtml(formatDateForPdf(stay.check_out))}</p>
          </div>
          <div class="record-row">
            <p><strong>Telefone:</strong> ${escapeHtml(stay.guest_phone || '-')}</p>
            <p><strong>Email:</strong> ${escapeHtml(stay.guest_email || '-')}</p>
            <p><strong>Morada:</strong> ${escapeHtml(stay.guest_address || '-')}</p>
          </div>
          <div class="record-row">
            <p><strong>Noites:</strong> ${nights}</p>
            <p><strong>Nº de Pessoas:</strong> ${stay.people_count}</p>
            <p><strong>Roupa:</strong> ${escapeHtml(stay.linen ?? '-')}</p>
          </div>
          <p class="record-notes"><strong>Notas:</strong> ${escapeHtml(notes)}</p>
        </article>
      `
    })
    .join('')

  return `<!doctype html>
<html lang="pt-PT">
  <head>
    <meta charset="utf-8" />
    <title>Exportação ${escapeHtml(monthLabel)} ${year}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <style>
      @import url('https://fonts.googleapis.com/css2?family=Rajdhani:wght@400;500;600;700&display=swap');
      @page {
        size: A4;
        margin: 8mm;
      }
      * {
        box-sizing: border-box;
      }
      body {
        margin: 0;
        font-family: 'Rajdhani', 'Segoe UI', sans-serif;
        color: #11283e;
        line-height: 1.2;
      }
      .sheet {
        width: 100%;
        display: grid;
        gap: 8px;
      }
      .header {
        display: grid;
        gap: 2px;
      }
      .header h1 {
        margin: 0;
        font-size: 28px;
        letter-spacing: 0.03em;
      }
      .header p {
        margin: 0;
        font-size: 17px;
        color: #42586d;
      }
      .calendar {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }
      .calendar th {
        padding: 4px 3px;
        border: 1px solid #d7e2ef;
        font-size: 14px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: #edf4fb;
      }
      .calendar .day {
        height: 20px;
        text-align: right;
        padding: 2px 4px;
        border: 1px solid #d7e2ef;
        font-size: 14px;
      }
      .calendar .day.empty {
        background: #f7f9fc;
      }
      .calendar .day.reserved {
        background: #bedcff;
        color: #063d77;
        font-weight: 700;
      }
      .records {
        display: grid;
        gap: 6px;
      }
      .record {
        padding: 8px 10px;
        border: 1px solid #5e6771;
        border-radius: 13px;
        background: #ffffff;
        page-break-inside: avoid;
      }
      .record-name {
        margin: 0 0 4px;
        color: #0d56a6;
        font-size: 18px;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: 0.01em;
      }
      .record p {
        margin: 0;
        font-size: 15px;
        color: #2d3136;
        line-height: 1.2;
      }
      .record strong {
        color: #3c3f44;
        font-weight: 700;
      }
      .record-dates {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px 10px;
        margin-bottom: 4px;
      }
      .record-entry {
        grid-column: 1;
      }
      .record-exit {
        grid-column: 2;
      }
      .record-row {
        display: grid;
        grid-template-columns: repeat(3, minmax(0, 1fr));
        gap: 4px 10px;
        margin-bottom: 4px;
      }
      .record-dates p,
      .record-row p,
      .record-notes {
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .record-notes {
        min-height: 14px;
      }
    </style>
  </head>
  <body>
    <main class="sheet">
      <header class="header">
        <h1>${escapeHtml(monthLabel)} ${year}</h1>
        <p>Apartamento: ${escapeHtml(apartmentLabel)} | Registos: ${stays.length}</p>
      </header>
      <table class="calendar" aria-label="Calendário de reservas">
        <thead>
          <tr>${weekdayHeaders.map((label) => `<th>${label}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${calendarRows}
        </tbody>
      </table>
      <section class="records">
        ${rowsHtml}
      </section>
    </main>
    ${
      outputMode === 'print'
        ? `<script>
      window.addEventListener('load', () => {
        setTimeout(() => window.print(), 150);
      });
      window.addEventListener('afterprint', () => window.close());
    </script>`
        : ''
    }
  </body>
</html>`
}

export default function Apartments() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [selectedApartmentId, setSelectedApartmentId] = useState<number | null>(null)
  const [selectedStayId, setSelectedStayId] = useState<number | null>(null)
  const [editorMode, setEditorMode] = useState<StayEditorMode>(null)
  const [form, setForm] = useState<GuestForm>(emptyForm)
  const [globalSearchText, setGlobalSearchText] = useState('')
  const [globalSearchResults, setGlobalSearchResults] = useState<StayWithApartment[]>([])
  const [hasSearched, setHasSearched] = useState(false)
  const [searchingGlobal, setSearchingGlobal] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [consultOpen, setConsultOpen] = useState(false)
  const [panelMode, setPanelMode] = useState<PanelMode>('consult')
  const [consultFilters, setConsultFilters] = useState<ConsultFilters>({
    apartmentId: '',
    year: '',
    month: '',
  })
  const [consultResults, setConsultResults] = useState<StayWithApartment[]>([])
  const [consultHasRun, setConsultHasRun] = useState(false)
  const [consultLoading, setConsultLoading] = useState(false)
  const [consultError, setConsultError] = useState<string | null>(null)
  const [exportResults, setExportResults] = useState<StayWithApartment[]>([])
  const [exportHasRun, setExportHasRun] = useState(false)
  const [exportLoading, setExportLoading] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)
  const [exportOptionsOpen, setExportOptionsOpen] = useState(false)
  const [pendingPdfExport, setPendingPdfExport] = useState<PendingPdfExport | null>(null)
  const [pdfFileName, setPdfFileName] = useState('')
  const [pdfDialogError, setPdfDialogError] = useState<string | null>(null)
  const [savingPdf, setSavingPdf] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyReference, setHistoryReference] = useState('')
  const [historyResults, setHistoryResults] = useState<StayWithApartment[]>([])
  const [pendingDeleteStay, setPendingDeleteStay] = useState<StayWithApartment | null>(null)
  const [deletingStay, setDeletingStay] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadingApartments, setLoadingApartments] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const exportOptionsRef = useRef<HTMLDivElement | null>(null)

  const selectedApartment = useMemo(
    () => apartments.find((apartment) => apartment.id === selectedApartmentId) ?? null,
    [apartments, selectedApartmentId],
  )

  const parsedPanelFilters = useMemo<ParsedFilters>(() => {
    const parsed = parseFilters(consultFilters)
    return (
      parsed.parsed ?? {
        apartmentId: null,
        year: null,
        month: null,
      }
    )
  }, [consultFilters])

  const exportGroups = useMemo(
    () => groupStaysForExport(exportResults, parsedPanelFilters),
    [exportResults, parsedPanelFilters],
  )

  const loadApartments = async () => {
    setLoadingApartments(true)
    setErrorMessage(null)
    try {
      const data = await listApartments()
      setApartments(data)
    } catch (error) {
      logError('Erro a carregar apartamentos', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao carregar apartamentos.'))
    } finally {
      setLoadingApartments(false)
    }
  }

  useEffect(() => {
    void loadApartments()
  }, [])

  useEffect(() => {
    if (!menuOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [menuOpen])

  useEffect(() => {
    if (!notice) return
    const timeoutId = window.setTimeout(() => {
      setNotice(null)
    }, 5000)
    return () => {
      window.clearTimeout(timeoutId)
    }
  }, [notice])

  useEffect(() => {
    if (!exportOptionsOpen) return

    const handleOutsideClick = (event: MouseEvent) => {
      if (exportOptionsRef.current && !exportOptionsRef.current.contains(event.target as Node)) {
        setExportOptionsOpen(false)
      }
    }

    document.addEventListener('mousedown', handleOutsideClick)
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick)
    }
  }, [exportOptionsOpen])

  const handleSelectApartment = (apartment: Apartment) => {
    setSelectedApartmentId(apartment.id)
    setSelectedStayId(null)
    setEditorMode('create')
    setForm(emptyForm)
    setErrorMessage(null)
    setNotice(null)
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setNotice(null)

    if (!selectedApartmentId) {
      setErrorMessage('Seleciona primeiro um apartamento.')
      return
    }

    const validated = validateGuestForm(form, selectedApartmentId)
    if ('error' in validated) {
      setErrorMessage(validated.error)
      return
    }

    setSubmitting(true)
    try {
      let saved: StayWithApartment

      if (editorMode === 'edit' && selectedStayId) {
        saved = await updateStay(selectedStayId, validated.payload)
        setNotice('Registo atualizado.')
      } else {
        saved = await createStay(validated.payload)
        setNotice('Registo criado.')
      }

      setEditorMode(null)
      setForm(emptyForm)
      setSelectedStayId(saved.id)
      setGlobalSearchResults((prev) =>
        prev.map((stay) => (stay.id === saved.id ? { ...stay, ...saved } : stay)),
      )
    } catch (error) {
      logError('Erro a guardar registo', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao guardar registo.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleGlobalSearch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const query = globalSearchText.trim().toLowerCase()
    setErrorMessage(null)
    setHasSearched(true)

    if (!query) {
      setGlobalSearchResults([])
      return
    }

    setSearchingGlobal(true)
    try {
      const allStays = await listStays({})
      const results = allStays
        .filter((stay) => {
          const fields = [
            stay.guest_name,
            stay.guest_email,
            stay.guest_phone,
            stay.guest_address,
            stay.notes ?? '',
            stay.apartment?.name ?? '',
            String(stay.year),
            stay.check_in ?? '',
            stay.check_out ?? '',
          ]
          return fields.some((value) => value.toLowerCase().includes(query))
        })
        .sort((left, right) => {
          const scoreDiff = getStayRecencyScore(right) - getStayRecencyScore(left)
          if (scoreDiff !== 0) return scoreDiff
          return right.id - left.id
        })
      setGlobalSearchResults(results)
    } catch (error) {
      logError('Erro na pesquisa global', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao pesquisar registos.'))
    } finally {
      setSearchingGlobal(false)
    }
  }

  const handleGlobalSearchInputChange = (value: string) => {
    setGlobalSearchText(value)
    if (!value.trim()) {
      setGlobalSearchResults([])
      setHasSearched(false)
    }
  }

  const handleClearGlobalSearch = () => {
    setGlobalSearchText('')
    setGlobalSearchResults([])
    setHasSearched(false)
    setSelectedApartmentId(null)
    setSelectedStayId(null)
    setEditorMode(null)
    setNotice(null)
    setErrorMessage(null)
  }

  const handleOpenSearchResult = (stay: StayWithApartment) => {
    setHistoryOpen(false)
    setErrorMessage(null)
    setNotice(null)
    setSelectedStayId(stay.id)
    setSelectedApartmentId(stay.apartment_id)
    setForm(toGuestForm(stay))
    setEditorMode('edit')
  }

  const handleCreateFromExisting = (stay: StayWithApartment) => {
    setHistoryOpen(false)
    setErrorMessage(null)
    setNotice(null)
    setSelectedStayId(null)
    setSelectedApartmentId(stay.apartment_id)
    setForm(toDuplicateGuestForm(stay))
    setEditorMode('create')
  }

  const handleOpenCustomerHistory = (stay: StayWithApartment) => {
    setHistoryError(null)
    setHistoryReference(stay.guest_name)
    setHistoryResults([stay])
    setHistoryLoading(false)
    setHistoryOpen(true)
  }

  const handleRequestDeleteStay = (stay: StayWithApartment) => {
    setDeleteError(null)
    setPendingDeleteStay(stay)
  }

  const handleCancelDeleteStay = () => {
    if (deletingStay) return
    setDeleteError(null)
    setPendingDeleteStay(null)
  }

  const handleConfirmDeleteStay = async () => {
    if (!pendingDeleteStay) return

    setDeletingStay(true)
    setDeleteError(null)
    setErrorMessage(null)
    setNotice(null)

    try {
      await deleteStay(pendingDeleteStay.id)
      setNotice('Registo eliminado.')
      setGlobalSearchResults((prev) => prev.filter((item) => item.id !== pendingDeleteStay.id))
      setConsultResults((prev) => prev.filter((item) => item.id !== pendingDeleteStay.id))
      setExportResults((prev) => prev.filter((item) => item.id !== pendingDeleteStay.id))
      setHistoryResults((prev) => prev.filter((item) => item.id !== pendingDeleteStay.id))

      if (selectedStayId === pendingDeleteStay.id) {
        setSelectedStayId(null)
        if (editorMode === 'edit') {
          setEditorMode(null)
          setForm(emptyForm)
        }
      }

      setPendingDeleteStay(null)
    } catch (error) {
      logError('Erro ao eliminar registo', error)
      setDeleteError(toPublicErrorMessage(error, 'Erro ao eliminar registo.'))
    } finally {
      setDeletingStay(false)
    }
  }

  const handleOpenConsult = () => {
    setMenuOpen(false)
    setExportOptionsOpen(false)
    setPendingPdfExport(null)
    setPdfDialogError(null)
    setPanelMode('consult')
    setConsultOpen(true)
    setConsultError(null)
    setExportError(null)
  }

  const handleOpenExport = () => {
    setMenuOpen(false)
    setExportOptionsOpen(false)
    setPendingPdfExport(null)
    setPdfDialogError(null)
    setPanelMode('export')
    setConsultOpen(true)
    setConsultError(null)
    setExportError(null)
  }

  const fetchFilteredStays = async (filters: ParsedFilters): Promise<StayWithApartment[]> => {
    const baseResults = await listStays({
      apartmentId: filters.apartmentId ?? undefined,
    })
    return filterStaysByFilters(baseResults, filters)
  }

  const handleConsultFilterChange = (field: keyof ConsultFilters, value: string) => {
    setConsultFilters((prev) => ({ ...prev, [field]: value }))
    setConsultError(null)
    setExportError(null)
    setExportOptionsOpen(false)
    setPendingPdfExport(null)
    setPdfDialogError(null)
  }

  const handleConsult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setConsultError(null)
    setConsultHasRun(true)
    const parsedFilters = parseFilters(consultFilters)
    if (parsedFilters.error || !parsedFilters.parsed) {
      setConsultError(parsedFilters.error ?? 'Filtros inválidos.')
      return
    }

    setConsultLoading(true)
    try {
      const filteredResults = await fetchFilteredStays(parsedFilters.parsed)
      setConsultResults(filteredResults)
    } catch (error) {
      logError('Erro na consulta de registos', error)
      setConsultError(toPublicErrorMessage(error, 'Erro ao consultar registos.'))
    } finally {
      setConsultLoading(false)
    }
  }

  const handleVisualizeExport = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setExportError(null)
    setExportHasRun(true)
    const parsedFilters = parseFilters(consultFilters)
    if (parsedFilters.error || !parsedFilters.parsed) {
      setExportError(parsedFilters.error ?? 'Filtros inválidos.')
      return
    }

    setExportLoading(true)
    try {
      const filteredResults = await fetchFilteredStays(parsedFilters.parsed)
      setExportResults(filteredResults)
    } catch (error) {
      logError('Erro na visualização de exportação', error)
      setExportError(toPublicErrorMessage(error, 'Erro ao visualizar registos para exportação.'))
    } finally {
      setExportLoading(false)
    }
  }

  const handleExportDocument = async (outputMode: ExportOutputMode) => {
    setExportError(null)
    setNotice(null)
    const parsedFilters = parseFilters(consultFilters)
    if (parsedFilters.error || !parsedFilters.parsed) {
      setExportError(parsedFilters.error ?? 'Filtros inválidos.')
      return
    }
    const filters = parsedFilters.parsed
    if (filters.year === null || filters.month === null) {
      setExportError('Para exportar, seleciona obrigatoriamente o ano e o mês.')
      return
    }

    setExportLoading(true)
    setExportHasRun(true)
    try {
      const filteredResults = await fetchFilteredStays(filters)
      setExportResults(filteredResults)

      if (filteredResults.length === 0) {
        setExportError('Sem registos para exportar com os filtros aplicados.')
        return
      }

      const apartmentLabel = filters.apartmentId
        ? apartments.find((apartment) => apartment.id === filters.apartmentId)?.name ??
          'Apartamento desconhecido'
        : 'Todos'
      const fileName = buildExportFileName(apartmentLabel, filters.month, filters.year)

      const html = buildExportDocumentHtml({
        stays: filteredResults,
        year: filters.year,
        month: filters.month,
        apartmentLabel,
        outputMode,
      })

      if (outputMode === 'print') {
        const printWindow = window.open('about:blank', '_blank')
        if (!printWindow) {
          setExportError('Não foi possível abrir a janela de impressão. Verifica o bloqueador de popups.')
          return
        }
        printWindow.document.open()
        printWindow.document.write(html)
        printWindow.document.close()
        setNotice('Janela de impressão preparada. Seleciona a impressora e confirma.')
      } else {
        setPdfDialogError(null)
        setPdfFileName(fileName)
        setPendingPdfExport({
          stays: filteredResults,
          year: filters.year,
          month: filters.month,
          apartmentLabel,
        })
      }
    } catch (error) {
      logError('Erro na exportação de registos', error)
      setExportError(toPublicErrorMessage(error, 'Erro ao exportar registos.'))
    } finally {
      setExportLoading(false)
    }
  }

  const handleCancelPdfSave = () => {
    if (savingPdf) return
    setPdfDialogError(null)
    setPendingPdfExport(null)
    setPdfFileName('')
  }

  const handleConfirmPdfSave = async () => {
    if (!pendingPdfExport) return

    const safeBaseName = pdfFileName
      .replace(/\.pdf$/i, '')
      .replace(/[\\/:*?"<>|]+/g, '-')
      .trim()
    if (!safeBaseName) {
      setPdfDialogError('Nome do ficheiro inválido.')
      return
    }
    const finalFileName = `${safeBaseName}.pdf`

    setSavingPdf(true)
    setPdfDialogError(null)
    setExportError(null)
    setNotice(null)
    try {
      const html = buildExportDocumentHtml({
        stays: pendingPdfExport.stays,
        year: pendingPdfExport.year,
        month: pendingPdfExport.month,
        apartmentLabel: pendingPdfExport.apartmentLabel,
        outputMode: 'pdf',
      })

      const pdfBlob = await buildPdfBlobFromHtml(html)
      const saveMethod = await savePdfBlob(pdfBlob, finalFileName)
      if (saveMethod === 'picker') {
        setNotice('PDF gravado com sucesso no local escolhido.')
      } else {
        setNotice(
          'PDF transferido. Se não apareceu a escolha de pasta, ativa no browser a opção para perguntar onde guardar cada transferência.',
        )
      }
      setPendingPdfExport(null)
      setPdfFileName('')
    } catch (error) {
      logError('Erro ao gravar PDF', error)
      setPdfDialogError(toPublicErrorMessage(error, 'Não foi possível gravar o PDF.'))
    } finally {
      setSavingPdf(false)
    }
  }

  const handleClearConsult = () => {
    setConsultFilters({ apartmentId: '', year: '', month: '' })
    setConsultResults([])
    setConsultHasRun(false)
    setConsultError(null)
  }

  const handleClearExport = () => {
    setConsultFilters({ apartmentId: '', year: '', month: '' })
    setExportResults([])
    setExportHasRun(false)
    setExportError(null)
    setExportOptionsOpen(false)
    setPendingPdfExport(null)
    setPdfDialogError(null)
    setPdfFileName('')
  }

  const handleOpenConsultResult = (stay: StayWithApartment) => {
    setConsultOpen(false)
    handleOpenSearchResult(stay)
  }

  const isConsultMode = panelMode === 'consult'

  return (
    <>
      <section className="workspace-shell">
        <div className="workspace-intro workspace-intro-with-menu">
          <div>
            <h1>Apartamentos</h1>
            <p>Escolhe um apartamento para gerir hóspedes e registos.</p>
          </div>
          <div className="workspace-menu-wrap" ref={menuRef}>
            <button
              type="button"
              className={`hamburger-btn ${menuOpen ? 'open' : ''}`}
              aria-label="Abrir menu"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen((prev) => !prev)}
            >
              <span />
              <span />
              <span />
            </button>
            {menuOpen && (
              <div className="workspace-menu-dropdown" role="menu">
                <button type="button" role="menuitem" onClick={handleOpenConsult}>
                  Consultar
                </button>
                <button type="button" role="menuitem" onClick={handleOpenExport}>
                  Exportar
                </button>
              </div>
            )}
          </div>
        </div>

        {consultOpen && (
          <div className="consult-panel">
            <div className="consult-panel-header">
              <div>
                <h2>{isConsultMode ? 'Consultar registos' : 'Exportar registos'}</h2>
                <p>
                  {isConsultMode
                    ? 'Filtra por apartamento, ano e mês.'
                    : 'Filtra por apartamento, ano e mês para visualizar ou exportar.'}
                </p>
              </div>
              <button
                type="button"
                className="consult-close-btn"
                onClick={() => setConsultOpen(false)}
              >
                Fechar
              </button>
            </div>

            <form className="consult-form" onSubmit={isConsultMode ? handleConsult : handleVisualizeExport}>
              <label>
                Apartamento
                <select
                  className="filter-select"
                  value={consultFilters.apartmentId}
                  onChange={(event) =>
                    handleConsultFilterChange('apartmentId', event.target.value)
                  }
                >
                  <option value="">Todos</option>
                  {apartments.map((apartment) => (
                    <option key={`filter-apartment-${apartment.id}`} value={String(apartment.id)}>
                      {apartment.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Ano
                <select
                  className="filter-select"
                  value={consultFilters.year}
                  onChange={(event) => handleConsultFilterChange('year', event.target.value)}
                >
                  <option value="">Todos</option>
                  {yearFilterOptions.map((yearOption) => (
                    <option key={yearOption} value={yearOption}>
                      {yearOption}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Mês
                <select
                  className="filter-select"
                  value={consultFilters.month}
                  onChange={(event) => handleConsultFilterChange('month', event.target.value)}
                >
                  <option value="">Todos</option>
                  {monthOptions.map((monthOption) => (
                    <option key={monthOption.value} value={monthOption.value}>
                      {monthOption.label}
                    </option>
                  ))}
                </select>
              </label>

              <div className="consult-actions">
                {isConsultMode ? (
                  <>
                    <button type="submit" disabled={consultLoading}>
                      {consultLoading ? 'A consultar...' : 'Consultar'}
                    </button>
                    <button type="button" className="clear-btn" onClick={handleClearConsult}>
                      Limpar
                    </button>
                  </>
                ) : (
                  <>
                    <button type="submit" disabled={exportLoading}>
                      {exportLoading ? 'A visualizar...' : 'Visualizar'}
                    </button>
                    <div className="export-actions-wrap" ref={exportOptionsRef}>
                      <button
                        type="button"
                        onClick={() => setExportOptionsOpen((prev) => !prev)}
                        disabled={exportLoading}
                        aria-expanded={exportOptionsOpen}
                        aria-haspopup="menu"
                      >
                        {exportLoading ? 'A exportar...' : 'Exportar'}
                      </button>
                      {exportOptionsOpen && (
                        <div className="export-options-dropdown" role="menu">
                          <button
                            type="button"
                            role="menuitem"
                            className="secondary"
                            onClick={() => {
                              setExportOptionsOpen(false)
                              void handleExportDocument('pdf')
                            }}
                          >
                            PDF
                          </button>
                          <button
                            type="button"
                            role="menuitem"
                            className="secondary"
                            onClick={() => {
                              setExportOptionsOpen(false)
                              void handleExportDocument('print')
                            }}
                          >
                            Imprimir
                          </button>
                        </div>
                      )}
                    </div>
                    <button type="button" className="clear-btn" onClick={handleClearExport}>
                      Limpar
                    </button>
                  </>
                )}
              </div>
            </form>

            {isConsultMode ? (
              <>
                {consultError && <p className="error">{consultError}</p>}

                {consultHasRun && (
                  <div className="consult-results">
                    <h3>Resultado da consulta</h3>
                    {consultLoading ? (
                      <p>A consultar...</p>
                    ) : consultResults.length === 0 ? (
                      <p className="empty-state">Sem registos para os filtros aplicados.</p>
                    ) : (
                      <ul>
                        {consultResults.map((stay) => (
                          <li key={`consult-${stay.id}`}>
                            <div>
                              <strong>{stay.guest_name}</strong>
                              <p>{stay.apartment?.name ?? 'Apartamento desconhecido'}</p>
                              <p>{stay.year}</p>
                            </div>
                            <div className="result-actions">
                              <button type="button" onClick={() => handleOpenConsultResult(stay)}>
                                Editar
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => handleCreateFromExisting(stay)}
                              >
                                Criar
                              </button>
                              <button
                                type="button"
                                className="secondary"
                                onClick={() => {
                                  void handleOpenCustomerHistory(stay)
                                }}
                              >
                                Consultar
                              </button>
                              <button
                                type="button"
                                className="danger-light"
                                onClick={() => {
                                  handleRequestDeleteStay(stay)
                                }}
                              >
                                Eliminar
                              </button>
                            </div>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            ) : (
              <>
                {exportError && <p className="error">{exportError}</p>}
                {exportHasRun && (
                  <div className="export-results">
                    <h3>Visualização para exportação</h3>
                    {exportLoading ? (
                      <p>A carregar registos...</p>
                    ) : exportResults.length === 0 ? (
                      <p className="empty-state">Sem registos para os filtros aplicados.</p>
                    ) : (
                      <div className="export-year-list">
                        {exportGroups.map((yearGroup) => (
                          <section key={`export-year-${yearGroup.year}`} className="export-year-group">
                            <header>
                              <h4>{yearGroup.year}</h4>
                              <span>{yearGroup.months.reduce((count, monthGroup) => count + monthGroup.stays.length, 0)} registos</span>
                            </header>
                            <div className="export-month-list">
                              {yearGroup.months.map((monthGroup) => (
                                <section
                                  key={`export-month-${yearGroup.year}-${monthGroup.month}`}
                                  className="export-month-group"
                                >
                                  <h5>
                                    {monthLabelByValue[String(monthGroup.month)] ?? `Mês ${monthGroup.month}`}
                                  </h5>
                                  <ul className="export-client-list">
                                    {monthGroup.stays.map((stay) => (
                                      <li key={`export-row-${stay.id}`}>
                                        <div className="export-client-header">
                                          <strong>{stay.guest_name}</strong>
                                          <span>{stay.apartment?.name ?? 'Apartamento desconhecido'}</span>
                                        </div>
                                        <div className="export-client-grid">
                                          <p>
                                            <span>Entrada:</span> {formatDateForDisplay(stay.check_in)}
                                          </p>
                                          <p>
                                            <span>Saída:</span> {formatDateForDisplay(stay.check_out)}
                                          </p>
                                          <p>
                                            <span>Noites:</span>{' '}
                                            {calculateNights(stay.check_in ?? '', stay.check_out ?? '') ??
                                              stay.nights_count}
                                          </p>
                                          <p>
                                            <span>Nº Pessoas:</span> {stay.people_count}
                                          </p>
                                          <p>
                                            <span>Roupa:</span> {stay.linen ?? '-'}
                                          </p>
                                          <p>
                                            <span>Email:</span> {stay.guest_email || '-'}
                                          </p>
                                          <p>
                                            <span>Telefone:</span> {stay.guest_phone || '-'}
                                          </p>
                                          <p>
                                            <span>Morada:</span> {stay.guest_address || '-'}
                                          </p>
                                          <p>
                                            <span>Ano:</span> {stay.year}
                                          </p>
                                          <p className="field-span-2">
                                            <span>Notas:</span>{' '}
                                            {stay.notes?.trim() ? stay.notes : '-'}
                                          </p>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </section>
                              ))}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {loadingApartments ? (
          <p>A carregar apartamentos...</p>
        ) : apartments.length === 0 ? (
          <p className="empty-state">
            Não existem apartamentos. Cria os apartamentos no Supabase para começar.
          </p>
        ) : (
          <div className="apartment-grid">
            {apartments.map((apartment) => (
              <button
                key={apartment.id}
                type="button"
                className={`apartment-tile ${selectedApartmentId === apartment.id ? 'selected' : ''}`}
                onClick={() => {
                  handleSelectApartment(apartment)
                }}
              >
                <span className="tile-label">CRIAR REGISTO</span>
                <strong>
                  {apartment.name}
                  {apartmentCardLicenseByName[apartment.name] && (
                    <span className="tile-license">
                      ({apartmentCardLicenseByName[apartment.name]})
                    </span>
                  )}
                </strong>
              </button>
            ))}
          </div>
        )}

        <form className="global-search-form" onSubmit={handleGlobalSearch}>
          <label>
            Pesquisa global (todos os apartamentos)
            <input
              type="search"
              value={globalSearchText}
              onChange={(event) => handleGlobalSearchInputChange(event.target.value)}
              placeholder="Nome, email, telefone, apartamento, datas..."
            />
          </label>
          <div className="global-search-actions">
            <button type="submit" disabled={searchingGlobal}>
              {searchingGlobal ? 'A pesquisar...' : 'Pesquisar'}
            </button>
            <button
              type="button"
              className="clear-btn"
              onClick={handleClearGlobalSearch}
              disabled={!globalSearchText && !hasSearched && globalSearchResults.length === 0}
            >
              Limpar
            </button>
          </div>
        </form>

        {hasSearched && (
          <div className="global-search-results">
            <h3>Resultados da pesquisa</h3>
            {searchingGlobal ? (
              <p>A pesquisar...</p>
            ) : globalSearchResults.length === 0 ? (
              <p className="empty-state">Sem resultados para a pesquisa atual.</p>
            ) : (
              <ul>
                {globalSearchResults.map((stay) => (
                  <li key={`search-${stay.id}`}>
                    <div>
                      <strong>{stay.guest_name}</strong>
                      <p>{stay.apartment?.name ?? 'Apartamento desconhecido'}</p>
                      <p>{stay.check_in ?? '-'} → {stay.check_out ?? '-'}</p>
                    </div>
                    <div className="result-actions">
                      <button
                        type="button"
                        onClick={() => {
                          handleOpenSearchResult(stay)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          handleCreateFromExisting(stay)
                        }}
                      >
                        Criar
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => {
                          void handleOpenCustomerHistory(stay)
                        }}
                      >
                        Consultar
                      </button>
                      <button
                        type="button"
                        className="danger-light"
                        onClick={() => {
                          handleRequestDeleteStay(stay)
                        }}
                      >
                        Eliminar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
      {historyOpen && (
        <div className="editor-backdrop" onClick={() => setHistoryOpen(false)}>
          <section className="history-panel" onClick={(event) => event.stopPropagation()}>
            <div className="history-header">
              <div>
                <h3>Consulta do registo</h3>
                <p>{historyReference}</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)}>
                Fechar
              </button>
            </div>

            {historyError && <p className="error">{historyError}</p>}

            {historyLoading ? (
              <p>A carregar registo...</p>
            ) : historyResults.length === 0 ? (
              <p className="empty-state">Sem dados para o registo selecionado.</p>
            ) : (
              <ul className="history-list">
                {historyResults.map((stay) => (
                  <li key={`history-${stay.id}`}>
                    <div className="history-details">
                      <strong>{stay.guest_name}</strong>
                      <p>
                        <span>Apartamento:</span> {stay.apartment?.name ?? 'Apartamento desconhecido'}
                      </p>
                      <p>
                        <span>Entrada:</span> {stay.check_in ?? '-'}
                      </p>
                      <p>
                        <span>Saída:</span> {stay.check_out ?? '-'}
                      </p>
                      <p>
                        <span>Noites:</span>{' '}
                        {calculateNights(stay.check_in ?? '', stay.check_out ?? '') ??
                          stay.nights_count}
                      </p>
                      <p>
                        <span>Nº Pessoas:</span> {stay.people_count}
                      </p>
                      <p>
                        <span>Roupa:</span> {stay.linen ?? '-'}
                      </p>
                      <p>
                        <span>Email:</span> {stay.guest_email || '-'}
                      </p>
                      <p>
                        <span>Telefone:</span> {stay.guest_phone || '-'}
                      </p>
                      <p>
                        <span>Morada:</span> {stay.guest_address || '-'}
                      </p>
                      <p>
                        <span>Ano:</span> {stay.year}
                      </p>
                      <p>
                        <span>Notas:</span> {stay.notes?.trim() ? stay.notes : '-'}
                      </p>
                    </div>
                    <div className="result-actions">
                      <button type="button" onClick={() => handleOpenSearchResult(stay)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() => handleCreateFromExisting(stay)}
                      >
                        Criar
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
      {pendingDeleteStay && (
        <div className="editor-backdrop" onClick={handleCancelDeleteStay}>
          <section className="confirm-panel" onClick={(event) => event.stopPropagation()}>
            <h3>Confirmar eliminação</h3>
            <p>
              Tens a certeza que queres eliminar o registo de{' '}
              <strong>{pendingDeleteStay.guest_name}</strong>?
            </p>
            {deleteError && <p className="error">{deleteError}</p>}
            <div className="confirm-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCancelDeleteStay}
                disabled={deletingStay}
              >
                Cancelar
              </button>
              <button
                type="button"
                className="danger-solid"
                onClick={() => {
                  void handleConfirmDeleteStay()
                }}
                disabled={deletingStay}
              >
                {deletingStay ? 'A eliminar...' : 'Eliminar registo'}
              </button>
            </div>
          </section>
        </div>
      )}
      {pendingPdfExport && (
        <div className="editor-backdrop" onClick={handleCancelPdfSave}>
          <section
            className="confirm-panel export-file-panel"
            onClick={(event) => event.stopPropagation()}
          >
            <h3>Guardar PDF</h3>
            <p>Define o nome do ficheiro e confirma a gravação.</p>
            <label>
              Nome do ficheiro
              <input
                type="text"
                value={pdfFileName}
                onChange={(event) => {
                  setPdfFileName(event.target.value)
                  setPdfDialogError(null)
                }}
                autoFocus
              />
            </label>
            <p className="dialog-help">
              Em alguns browsers, a escolha da pasta depende da opção de download "Perguntar onde
              guardar cada ficheiro".
            </p>
            {pdfDialogError && <p className="error">{pdfDialogError}</p>}
            <div className="confirm-actions">
              <button
                type="button"
                className="secondary"
                onClick={handleCancelPdfSave}
                disabled={savingPdf}
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  void handleConfirmPdfSave()
                }}
                disabled={savingPdf}
              >
                {savingPdf ? 'A gravar...' : 'Guardar PDF'}
              </button>
            </div>
          </section>
        </div>
      )}
      {notice && <p className="notice">{notice}</p>}
      {errorMessage && !editorMode && <p className="error">{errorMessage}</p>}

      {editorMode && selectedApartment && (
        <div className="editor-backdrop" onClick={() => setEditorMode(null)}>
          <section className="editor-panel" onClick={(event) => event.stopPropagation()}>
            <div className="editor-header">
              <div>
                <h3>{editorMode === 'edit' ? 'Editar registo' : 'Novo registo'}</h3>
                <p>{selectedApartment.name}</p>
              </div>
              <button type="button" onClick={() => setEditorMode(null)}>
                Fechar
              </button>
            </div>
            {errorMessage && <p className="error">{errorMessage}</p>}

            <form className="guest-form" onSubmit={handleSubmit}>
              <label>
                Nome do hóspede
                <input
                  type="text"
                  value={form.guest_name}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, guest_name: event.target.value }))
                  }
                  minLength={2}
                  maxLength={120}
                  required
                />
              </label>
              <label>
                Telefone
                <input
                  type="text"
                  value={form.guest_phone}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, guest_phone: event.target.value }))
                  }
                  minLength={6}
                  maxLength={20}
                  required
                />
              </label>
              <label>
                Email
                <input
                  type="email"
                  value={form.guest_email}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, guest_email: event.target.value }))
                  }
                  autoComplete="email"
                  required
                />
              </label>
              <label>
                Morada
                <input
                  type="text"
                  value={form.guest_address}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, guest_address: event.target.value }))
                  }
                  minLength={3}
                  maxLength={200}
                  required
                />
              </label>
              <DatePickerInput
                label="Entrada / Saída"
                startValue={form.check_in}
                endValue={form.check_out}
                onChange={(startValue, endValue) =>
                  setForm((prev) => ({
                    ...prev,
                    check_in: startValue,
                    check_out: endValue,
                  }))
                }
              />
              <p className="stay-nights-preview stay-nights-slot">
                <span>Noites calculadas:</span>
                <strong>{calculateNights(form.check_in, form.check_out) ?? '-'}</strong>
              </p>
              <label>
                Nº Pessoas
                <select
                  className="filter-select"
                  value={form.people_count}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, people_count: event.target.value }))
                  }
                  required
                >
                  <option value="1">1</option>
                  <option value="2">2</option>
                  <option value="3">3</option>
                  <option value="4">4</option>
                  <option value="5">5</option>
                  <option value="6">6</option>
                  <option value="7">7</option>
                  <option value="8">8</option>
                  <option value="9">9</option>
                  <option value="10">10+</option>
                </select>
              </label>
              <label>
                Roupa
                <select
                  className="filter-select"
                  value={form.linen}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, linen: event.target.value }))
                  }
                  required
                >
                  <option value="Com Roupa">Com Roupa</option>
                  <option value="Sem Roupa">Sem Roupa</option>
                </select>
              </label>
              <label className="field-span-2">
                Notas
                <textarea
                  value={form.notes}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, notes: event.target.value }))
                  }
                  maxLength={1000}
                />
              </label>

              <div className="editor-actions field-span-2">
                <button type="submit" disabled={submitting}>
                  {submitting
                    ? 'A guardar...'
                    : editorMode === 'edit'
                      ? 'Guardar alterações'
                      : 'Criar registo'}
                </button>
                <button type="button" onClick={() => setEditorMode(null)}>
                  Cancelar
                </button>
              </div>
            </form>
          </section>
        </div>
      )}
    </>
  )
}
