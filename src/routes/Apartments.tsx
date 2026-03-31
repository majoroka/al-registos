import { type ChangeEvent, type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  amount_paid: string
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

type PanelMode = 'consult' | 'visualize' | 'export' | 'print' | 'backup'

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

type StayColor = {
  fill: string
  border: string
  text: string
}

type CalendarDayPaint = {
  className: string
  background: string
  color: string
}

type CalendarDayCell = {
  key: string
  dayNumber: number
  className: string
  paint: CalendarDayPaint | null
}

type MonthCalendarView = {
  rows: CalendarDayCell[][]
  orderedStays: StayWithApartment[]
  colorByStayId: Map<number, StayColor>
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
const weekdayHeaders = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const apartmentCardLicenseByName: Record<string, string> = {
  'T1 - Tropical': '8168/AL',
  'T2 - Caravela': '4668/AL',
}

const exportStayPalette: StayColor[] = [
  { fill: '#5e837c', border: '#5e837c', text: '#ffffff' },
  { fill: '#ff8786', border: '#ff8786', text: '#ffffff' },
  { fill: '#1872cf', border: '#1872cf', text: '#ffffff' },
  { fill: '#90c20e', border: '#90c20e', text: '#ffffff' },
  { fill: '#ffbc08', border: '#ffbc08', text: '#1f2a33' },
]

const emptyForm: GuestForm = {
  guest_name: '',
  guest_phone: '',
  guest_email: '',
  guest_address: '',
  people_count: '1',
  amount_paid: '',
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

function parseMoneyInput(value: string): number | null {
  const trimmed = value.trim()
  if (!trimmed) return null

  const sanitized = trimmed.replace(/\s|€/g, '')
  let normalized = sanitized

  if (sanitized.includes(',')) {
    normalized = sanitized.replace(/\./g, '').replace(',', '.')
  } else if (/^\d{1,3}(\.\d{3})+$/.test(sanitized)) {
    normalized = sanitized.replace(/\./g, '')
  }

  if (!/^\d+(\.\d{1,2})?$/.test(normalized)) return null

  const parsed = Number(normalized)
  if (!Number.isFinite(parsed) || parsed < 0) return null

  return Math.round(parsed * 100) / 100
}

function formatMoneyForDisplay(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '-'

  return new Intl.NumberFormat('pt-PT', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value)
}

function formatMoneyForInput(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return ''
  return value.toFixed(2).replace('.', ',')
}

function calculateAmountPerDay(
  amountPaid: number | null | undefined,
  nightsCount: number | null | undefined,
): number | null {
  if (
    amountPaid === null ||
    amountPaid === undefined ||
    !Number.isFinite(amountPaid) ||
    !nightsCount ||
    nightsCount <= 0
  ) {
    return null
  }

  return Math.round((amountPaid / nightsCount) * 100) / 100
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
  const normalized = value.trim()
  if (!normalized) return null

  const isoDatePrefix = normalized.match(/^(\d{4})-(\d{2})-(\d{2})/)
  if (isoDatePrefix) {
    const [, y, m, d] = isoDatePrefix
    const parsed = new Date(Number(y), Number(m) - 1, Number(d))
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }

  const ptDate = normalized.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (ptDate) {
    const [, d, m, y] = ptDate
    const parsed = new Date(Number(y), Number(m) - 1, Number(d))
    if (Number.isNaN(parsed.getTime())) return null
    return parsed
  }

  const parsed = new Date(normalized)
  if (Number.isNaN(parsed.getTime())) return null
  return new Date(parsed.getFullYear(), parsed.getMonth(), parsed.getDate())
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
    amount_paid: formatMoneyForInput(stay.amount_paid),
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
    amount_paid: '',
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

function getColorForStay(index: number): StayColor {
  return exportStayPalette[index % exportStayPalette.length]
}

function toIsoDayKey(date: Date): string {
  const year = String(date.getFullYear())
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function buildExportFileName(apartmentLabel: string, month: number, year: number): string {
  const monthLabel = monthLabelByValue[String(month)] ?? `mes-${month}`
  return `registos-${toFileNameSegment(apartmentLabel || 'todos')}-${toFileNameSegment(monthLabel)}-${year}.pdf`
}

type BackupFormat = 'csv' | 'json'

type BackupRow = {
  id: number
  guest_name: string
  guest_phone: string
  guest_email: string
  guest_address: string
  apartment_id: number
  apartment_name: string
  people_count: number
  nights_count: number
  amount_paid: number | null
  linen: string
  notes: string
  check_in: string
  check_out: string
  year: number
  created_at: string
}

type BackupInvalidRow = {
  rowNumber: number
  guestName: string
  apartmentName: string
  reason: string
}

type BackupImportPreview = {
  fileName: string
  totalRows: number
  readyRows: number
  duplicateRows: number
  invalidRows: number
  invalidEntries: BackupInvalidRow[]
  payloads: StayInput[]
}

function toBackupRows(stays: StayWithApartment[]): BackupRow[] {
  return stays.map((stay) => ({
    id: stay.id,
    guest_name: stay.guest_name,
    guest_phone: stay.guest_phone,
    guest_email: stay.guest_email,
    guest_address: stay.guest_address,
    apartment_id: stay.apartment_id,
    apartment_name: stay.apartment?.name ?? '',
    people_count: stay.people_count,
    nights_count: stay.nights_count,
    amount_paid: stay.amount_paid ?? null,
    linen: stay.linen ?? '',
    notes: stay.notes ?? '',
    check_in: stay.check_in ?? '',
    check_out: stay.check_out ?? '',
    year: stay.year,
    created_at: stay.created_at ?? '',
  }))
}

function escapeCsvValue(value: string | number | null): string {
  const raw = String(value ?? '')
  if (!/[",\n]/.test(raw)) return raw
  return `"${raw.replace(/"/g, '""')}"`
}

function buildBackupCsv(rows: BackupRow[]): string {
  const headers: Array<keyof BackupRow> = [
    'id',
    'guest_name',
    'guest_phone',
    'guest_email',
    'guest_address',
    'apartment_id',
    'apartment_name',
    'people_count',
    'nights_count',
    'amount_paid',
    'linen',
    'notes',
    'check_in',
    'check_out',
    'year',
    'created_at',
  ]

  const lines = [
    headers.join(','),
    ...rows.map((row) => headers.map((header) => escapeCsvValue(row[header])).join(',')),
  ]
  return lines.join('\n')
}

function buildBackupFileName(format: BackupFormat): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `al-registos-backup-${stamp}.${format}`
}

function buildBackupZipFileName(): string {
  const now = new Date()
  const stamp = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}${String(now.getDate()).padStart(2, '0')}-${String(now.getHours()).padStart(2, '0')}${String(now.getMinutes()).padStart(2, '0')}`
  return `al-registos-backup-${stamp}.zip`
}

const textEncoder = new TextEncoder()
const textDecoder = new TextDecoder()

const crcTable = (() => {
  const table = new Uint32Array(256)
  for (let i = 0; i < 256; i += 1) {
    let crc = i
    for (let bit = 0; bit < 8; bit += 1) {
      crc = (crc & 1) ? (0xedb88320 ^ (crc >>> 1)) : (crc >>> 1)
    }
    table[i] = crc >>> 0
  }
  return table
})()

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < data.length; i += 1) {
    crc = crcTable[(crc ^ data[i]) & 0xff] ^ (crc >>> 8)
  }
  return (crc ^ 0xffffffff) >>> 0
}

function pushUint16LE(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff)
}

function pushUint32LE(target: number[], value: number): void {
  target.push(value & 0xff, (value >>> 8) & 0xff, (value >>> 16) & 0xff, (value >>> 24) & 0xff)
}

function toDosDateTime(date: Date): { dosDate: number; dosTime: number } {
  const year = Math.max(1980, date.getFullYear())
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate()
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | Math.floor(date.getSeconds() / 2)
  return { dosDate, dosTime }
}

function buildBackupZipBlob(files: Array<{ name: string; content: string }>): Blob {
  const bodyParts: Uint8Array[] = []
  const centralParts: Uint8Array[] = []
  const now = new Date()
  const { dosDate, dosTime } = toDosDateTime(now)
  let offset = 0

  for (const file of files) {
    const fileNameBytes = textEncoder.encode(file.name)
    const fileData = textEncoder.encode(file.content)
    const checksum = crc32(fileData)
    const localOffset = offset

    const localHeader: number[] = []
    pushUint32LE(localHeader, 0x04034b50)
    pushUint16LE(localHeader, 20)
    pushUint16LE(localHeader, 0)
    pushUint16LE(localHeader, 0)
    pushUint16LE(localHeader, dosTime)
    pushUint16LE(localHeader, dosDate)
    pushUint32LE(localHeader, checksum)
    pushUint32LE(localHeader, fileData.length)
    pushUint32LE(localHeader, fileData.length)
    pushUint16LE(localHeader, fileNameBytes.length)
    pushUint16LE(localHeader, 0)

    const localHeaderBytes = Uint8Array.from(localHeader)
    bodyParts.push(localHeaderBytes, fileNameBytes, fileData)
    offset += localHeaderBytes.length + fileNameBytes.length + fileData.length

    const centralHeader: number[] = []
    pushUint32LE(centralHeader, 0x02014b50)
    pushUint16LE(centralHeader, 20)
    pushUint16LE(centralHeader, 20)
    pushUint16LE(centralHeader, 0)
    pushUint16LE(centralHeader, 0)
    pushUint16LE(centralHeader, dosTime)
    pushUint16LE(centralHeader, dosDate)
    pushUint32LE(centralHeader, checksum)
    pushUint32LE(centralHeader, fileData.length)
    pushUint32LE(centralHeader, fileData.length)
    pushUint16LE(centralHeader, fileNameBytes.length)
    pushUint16LE(centralHeader, 0)
    pushUint16LE(centralHeader, 0)
    pushUint16LE(centralHeader, 0)
    pushUint16LE(centralHeader, 0)
    pushUint32LE(centralHeader, 0)
    pushUint32LE(centralHeader, localOffset)

    centralParts.push(Uint8Array.from(centralHeader), fileNameBytes)
  }

  const centralStart = offset
  for (const part of centralParts) {
    offset += part.length
  }
  const centralSize = offset - centralStart

  const endRecord: number[] = []
  pushUint32LE(endRecord, 0x06054b50)
  pushUint16LE(endRecord, 0)
  pushUint16LE(endRecord, 0)
  pushUint16LE(endRecord, files.length)
  pushUint16LE(endRecord, files.length)
  pushUint32LE(endRecord, centralSize)
  pushUint32LE(endRecord, centralStart)
  pushUint16LE(endRecord, 0)

  return new Blob([...bodyParts, ...centralParts, Uint8Array.from(endRecord)], {
    type: 'application/zip',
  })
}

function splitCsvLine(line: string): string[] {
  const values: string[] = []
  let current = ''
  let inQuotes = false

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index]
    const next = line[index + 1]

    if (char === '"') {
      if (inQuotes && next === '"') {
        current += '"'
        index += 1
      } else {
        inQuotes = !inQuotes
      }
      continue
    }

    if (char === ',' && !inQuotes) {
      values.push(current)
      current = ''
      continue
    }

    current += char
  }

  values.push(current)
  return values
}

function parseBackupCsv(csvText: string): BackupRow[] {
  const rawLines = csvText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
  if (rawLines.length <= 1) return []

  const header = splitCsvLine(rawLines[0])
  const rows: BackupRow[] = []

  for (let index = 1; index < rawLines.length; index += 1) {
    const values = splitCsvLine(rawLines[index])
    const row = Object.fromEntries(header.map((key, colIndex) => [key, values[colIndex] ?? '']))

    rows.push({
      id: Number(row.id || 0),
      guest_name: row.guest_name || '',
      guest_phone: row.guest_phone || '',
      guest_email: row.guest_email || '',
      guest_address: row.guest_address || '',
      apartment_id: Number(row.apartment_id || 0),
      apartment_name: row.apartment_name || '',
      people_count: Number(row.people_count || 0),
      nights_count: Number(row.nights_count || 0),
      amount_paid: row.amount_paid === '' || row.amount_paid === undefined ? null : Number(row.amount_paid),
      linen: row.linen || '',
      notes: row.notes || '',
      check_in: row.check_in || '',
      check_out: row.check_out || '',
      year: Number(row.year || 0),
      created_at: row.created_at || '',
    })
  }

  return rows
}

function normalizeBackupRows(rawRows: unknown): BackupRow[] {
  if (!Array.isArray(rawRows)) return []
  return rawRows.map((row) => {
    const safe = typeof row === 'object' && row !== null ? (row as Record<string, unknown>) : {}
    return {
      id: Number(safe.id ?? 0),
      guest_name: String(safe.guest_name ?? ''),
      guest_phone: String(safe.guest_phone ?? ''),
      guest_email: String(safe.guest_email ?? ''),
      guest_address: String(safe.guest_address ?? ''),
      apartment_id: Number(safe.apartment_id ?? 0),
      apartment_name: String(safe.apartment_name ?? ''),
      people_count: Number(safe.people_count ?? 0),
      nights_count: Number(safe.nights_count ?? 0),
      amount_paid:
        safe.amount_paid === null || safe.amount_paid === undefined || safe.amount_paid === ''
          ? null
          : Number(safe.amount_paid),
      linen: String(safe.linen ?? ''),
      notes: String(safe.notes ?? ''),
      check_in: String(safe.check_in ?? ''),
      check_out: String(safe.check_out ?? ''),
      year: Number(safe.year ?? 0),
      created_at: String(safe.created_at ?? ''),
    }
  })
}

async function extractRowsFromBackupZip(file: File): Promise<BackupRow[]> {
  const buffer = await file.arrayBuffer()
  const bytes = new Uint8Array(buffer)
  const view = new DataView(buffer)
  const fileContents = new Map<string, string>()
  let offset = 0

  while (offset + 4 <= bytes.length) {
    const signature = view.getUint32(offset, true)
    if (signature !== 0x04034b50) break
    if (offset + 30 > bytes.length) break

    const flags = view.getUint16(offset + 6, true)
    const compression = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const fileNameLength = view.getUint16(offset + 26, true)
    const extraLength = view.getUint16(offset + 28, true)

    if ((flags & 0x08) !== 0) {
      throw new Error('ZIP com data descriptor não suportado.')
    }
    if (compression !== 0) {
      throw new Error('ZIP comprimido não suportado. Usa o ZIP gerado pela aplicação.')
    }

    const nameStart = offset + 30
    const nameEnd = nameStart + fileNameLength
    const dataStart = nameEnd + extraLength
    const dataEnd = dataStart + compressedSize
    if (dataEnd > bytes.length) break

    const name = textDecoder.decode(bytes.slice(nameStart, nameEnd))
    const content = textDecoder.decode(bytes.slice(dataStart, dataEnd))
    fileContents.set(name, content)
    offset = dataEnd
  }

  const jsonEntry = Array.from(fileContents.entries()).find(([name]) =>
    name.toLowerCase().endsWith('.json'),
  )
  if (jsonEntry) {
    try {
      return normalizeBackupRows(JSON.parse(jsonEntry[1]))
    } catch {
      // fallback to CSV
    }
  }

  const csvEntry = Array.from(fileContents.entries()).find(([name]) =>
    name.toLowerCase().endsWith('.csv'),
  )
  if (csvEntry) {
    return parseBackupCsv(csvEntry[1])
  }

  throw new Error('O ZIP não contém ficheiro de backup válido (.json ou .csv).')
}

function downloadBlob(blob: Blob, fileName: string): void {
  const blobUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = blobUrl
  link.download = fileName
  document.body.appendChild(link)
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(blobUrl), 4000)
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
    const marginX = 15
    const marginY = 15
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
  const amountPaid = form.amount_paid.trim() ? parseMoneyInput(form.amount_paid) : null
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

  if (form.amount_paid.trim() && amountPaid === null) {
    return { error: 'Valor pago inválido. Usa um valor numérico, por exemplo 700 ou 700,50.' }
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
      amount_paid: amountPaid,
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

function sortStaysForCalendar(stays: StayWithApartment[]): StayWithApartment[] {
  return [...stays].sort((left, right) => {
    const leftInterval = getStayInterval(left)
    const rightInterval = getStayInterval(right)
    const leftStart =
      leftInterval?.start.getTime() ??
      parseDateSafe(left.check_out)?.getTime() ??
      new Date(left.year, 0, 1).getTime()
    const rightStart =
      rightInterval?.start.getTime() ??
      parseDateSafe(right.check_out)?.getTime() ??
      new Date(right.year, 0, 1).getTime()
    if (leftStart !== rightStart) return leftStart - rightStart

    const leftEnd = leftInterval?.end.getTime() ?? Number.MAX_SAFE_INTEGER
    const rightEnd = rightInterval?.end.getTime() ?? Number.MAX_SAFE_INTEGER
    if (leftEnd !== rightEnd) return leftEnd - rightEnd

    return left.id - right.id
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

function addUniqueDayStay(map: Map<string, number[]>, day: string, stayId: number): void {
  const existing = map.get(day)
  if (!existing) {
    map.set(day, [stayId])
    return
  }
  if (!existing.includes(stayId)) {
    existing.push(stayId)
  }
}

function buildMultiColorGradient(colors: string[]): string {
  if (colors.length === 0) return ''
  if (colors.length === 1) return colors[0]

  const stops = colors
    .map((color, index) => {
      const start = (100 / colors.length) * index
      const end = (100 / colors.length) * (index + 1)
      return `${color} ${start}%, ${color} ${end}%`
    })
    .join(', ')
  return `linear-gradient(90deg, ${stops})`
}

function buildCalendarDayStyles(
  stays: StayWithApartment[],
  year: number,
  month: number,
  colorByStayId: Map<number, StayColor>,
): Map<string, CalendarDayPaint> {
  const dayStyles = new Map<string, CalendarDayPaint>()
  const occupancyByDay = new Map<string, number[]>()
  const arrivalsByDay = new Map<string, number[]>()
  const departuresByDay = new Map<string, number[]>()
  const monthStart = new Date(year, month - 1, 1)
  const monthStartWeekday = (monthStart.getDay() + 6) % 7
  const gridStart = new Date(year, month - 1, 1 - monthStartWeekday)
  const gridEnd = addDays(gridStart, 42)

  for (const stay of stays) {
    const interval = getStayInterval(stay)
    const checkInDate = parseDateSafe(stay.check_in)
    const checkOutDate = parseDateSafe(stay.check_out)
    const departureDate = checkOutDate ?? interval?.end ?? null

    if (checkInDate && checkInDate >= gridStart && checkInDate < gridEnd) {
      addUniqueDayStay(arrivalsByDay, toIsoDayKey(checkInDate), stay.id)
    }
    if (departureDate && departureDate >= gridStart && departureDate < gridEnd) {
      addUniqueDayStay(departuresByDay, toIsoDayKey(departureDate), stay.id)
    }

    if (!interval || !intervalOverlaps(interval.start, interval.end, gridStart, gridEnd)) continue

    const overlapStart = interval.start > gridStart ? interval.start : gridStart
    const overlapEnd = interval.end < gridEnd ? interval.end : gridEnd
    const cursor = new Date(overlapStart)

    while (cursor < overlapEnd) {
      addUniqueDayStay(occupancyByDay, toIsoDayKey(cursor), stay.id)
      cursor.setDate(cursor.getDate() + 1)
    }
  }

  for (let index = 0; index < 42; index += 1) {
    const dayDate = addDays(gridStart, index)
    const dayKey = toIsoDayKey(dayDate)
    const occupiedIds = occupancyByDay.get(dayKey) ?? []
    const arrivalIds = arrivalsByDay.get(dayKey) ?? []
    const departureIds = departuresByDay.get(dayKey) ?? []
    const isOutsideMonth = dayDate.getMonth() + 1 !== month || dayDate.getFullYear() !== year

    const departureId = departureIds[0] ?? null
    const arrivalId = arrivalIds.find((id) => id !== departureId) ?? arrivalIds[0] ?? null
    const solidDayTextColor = '#ffffff'

    if (departureId !== null && arrivalId !== null && departureId !== arrivalId) {
      const depColor = colorByStayId.get(departureId)
      const arrColor = colorByStayId.get(arrivalId)
      if (depColor && arrColor) {
        dayStyles.set(dayKey, {
          className: isOutsideMonth ? 'turnover spillover' : 'turnover',
          background: `linear-gradient(135deg, ${depColor.border} 0%, ${depColor.border} 49%, ${arrColor.border} 51%, ${arrColor.border} 100%)`,
          color: solidDayTextColor,
        })
        continue
      }
    }

    if (occupiedIds.length === 0) {
      if (departureId !== null) {
        const depColor = colorByStayId.get(departureId)
        if (depColor) {
          const baseDayColor = isOutsideMonth ? '#f4f7fb' : '#ffffff'
          dayStyles.set(dayKey, {
            className: isOutsideMonth ? 'departure spillover' : 'departure',
            background: `linear-gradient(135deg, ${depColor.border} 0%, ${depColor.border} 50.2%, ${baseDayColor} 50.2%, ${baseDayColor} 100%)`,
            color: solidDayTextColor,
          })
        }
      }
      continue
    }

    const colors = occupiedIds
      .map((id) => colorByStayId.get(id)?.border)
      .filter((value): value is string => Boolean(value))
    const primaryColor = colorByStayId.get(occupiedIds[0])
    if (!primaryColor || colors.length === 0) continue

    dayStyles.set(dayKey, {
      className: isOutsideMonth ? 'occupied spillover' : 'occupied',
      background: buildMultiColorGradient(colors),
      color: solidDayTextColor,
    })
  }

  return dayStyles
}

function buildMonthCalendarView(
  stays: StayWithApartment[],
  year: number,
  month: number,
): MonthCalendarView {
  const orderedStays = sortStaysForCalendar(stays)
  const colorByStayId = new Map<number, StayColor>()
  orderedStays.forEach((stay, index) => {
    colorByStayId.set(stay.id, getColorForStay(index))
  })

  const dayStyles = buildCalendarDayStyles(orderedStays, year, month, colorByStayId)
  const monthStartWeekday = (new Date(year, month - 1, 1).getDay() + 6) % 7
  const gridStart = new Date(year, month - 1, 1 - monthStartWeekday)

  const cells = Array.from({ length: 42 }, (_, index) => {
    const cellDate = addDays(gridStart, index)
    const dayKey = toIsoDayKey(cellDate)
    const isOutsideMonth = cellDate.getMonth() + 1 !== month || cellDate.getFullYear() !== year
    const paint = dayStyles.get(dayKey) ?? null
    const classNames = ['day']
    if (isOutsideMonth) classNames.push('outside')
    if (paint) classNames.push(paint.className)

    return {
      key: dayKey,
      dayNumber: cellDate.getDate(),
      className: classNames.join(' '),
      paint,
    }
  })

  const rows = Array.from({ length: 6 }, (_, rowIndex) => {
    const start = rowIndex * 7
    return cells.slice(start, start + 7)
  })

  return {
    rows,
    orderedStays,
    colorByStayId,
  }
}

function toInlineDayStyle(paint: CalendarDayPaint): string {
  return `background: ${paint.background}; color: ${paint.color};`
}

function buildExportDocumentHtml(params: {
  stays: StayWithApartment[]
  year: number
  month: number
  apartmentLabel: string
  outputMode: ExportOutputMode
}): string {
  const { stays, year, month, apartmentLabel, outputMode } = params
  const monthCalendar = buildMonthCalendarView(stays, year, month)
  const { orderedStays, colorByStayId, rows } = monthCalendar
  const monthLabel = monthLabelByValue[String(month)] ?? `Mês ${month}`
  const calendarRows = rows
    .map((row) => {
      const cellsHtml = row
        .map((cell) => {
          const styleAttr = cell.paint ? ` style="${toInlineDayStyle(cell.paint)}"` : ''
          return `<td class="${cell.className}"${styleAttr}><span class="day-chip">${cell.dayNumber}</span></td>`
        })
        .join('')
      return `<tr>${cellsHtml}</tr>`
    })
    .join('')

  const rowsHtml = orderedStays
    .map((stay, index) => {
      const nights = calculateNights(stay.check_in ?? '', stay.check_out ?? '') ?? stay.nights_count
      const amountPerDay = calculateAmountPerDay(stay.amount_paid, nights)
      const notes = stay.notes?.trim() ? stay.notes : '-'
      const stayColor = colorByStayId.get(stay.id) ?? getColorForStay(index)

      return `
        <article class="record" style="--stay-dot:${stayColor.border};">
          <span class="record-dot" aria-hidden="true"></span>
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
          <div class="record-row">
            <p><strong>Valor pago:</strong> ${escapeHtml(formatMoneyForDisplay(stay.amount_paid))}</p>
            <p><strong>Valor/dia:</strong> ${escapeHtml(formatMoneyForDisplay(amountPerDay))}</p>
            <p></p>
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
        margin: 15mm;
      }
      * {
        box-sizing: border-box;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }
      body {
        margin: 0;
        font-family: 'Rajdhani', 'Segoe UI', sans-serif;
        color: #11283e;
        line-height: 1.2;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
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
        font-size: 25px;
        letter-spacing: 0.03em;
        color: #90c20e;
      }
      .header p {
        margin: 0;
        font-size: 15px;
        color: #5e837c;
      }
      .calendar-wrap {
        border: 1px solid #5e837c;
        border-radius: 12px;
        background: linear-gradient(160deg, #5e837c1f, #90c20e1a);
        padding: 6px;
        box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.8);
      }
      .calendar {
        width: 100%;
        border-collapse: separate;
        border-spacing: 2px;
        table-layout: fixed;
      }
      .calendar th {
        padding: 4px 3px;
        border: 1px solid #5e837c66;
        border-radius: 7px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.04em;
        background: #5e837c2b;
        color: #2d3136;
      }
      .calendar .day {
        height: 26px;
        text-align: center;
        padding: 0;
        border: 0;
        border-radius: 7px;
        font-size: 12px;
        font-weight: 600;
        background: #ffffff;
        color: #2d3136;
      }
      .calendar .day .day-chip {
        width: 22px;
        height: 22px;
        margin: 0 auto;
        border-radius: 999px;
        display: inline-flex;
        align-items: center;
        justify-content: center;
        background: #ffffff;
        color: #111111;
      }
      .calendar .day.outside {
        background: #f4f7fb;
      }
      .calendar .day.outside .day-chip {
        background: #eceff2;
        color: #8f98a3;
      }
      .calendar .day.occupied,
      .calendar .day.turnover {
        font-weight: 700;
        box-shadow: none;
      }
      .calendar .day.occupied .day-chip,
      .calendar .day.turnover .day-chip {
        background: #ffffff;
        color: #111111;
        text-shadow: none;
      }
      .calendar .day.outside.occupied .day-chip,
      .calendar .day.outside.turnover .day-chip {
        background: #eceff2;
        color: #8f98a3;
      }
      .calendar-meta {
        margin-top: 4px;
        font-size: 11px;
        color: #5e837c;
      }
      .records {
        display: grid;
        gap: 6px;
      }
      .record {
        position: relative;
        padding: 8px 10px;
        border: 1px solid #5e837c;
        border-radius: 13px;
        background: #ffffff;
        page-break-inside: avoid;
      }
      .record-dot {
        position: absolute;
        right: 10px;
        top: 7px;
        width: 20px;
        height: 20px;
        border-radius: 999px;
        background: var(--stay-dot, #90c20e);
      }
      .record-name {
        margin: 0 14px 4px 0;
        color: var(--stay-dot, #90c20e);
        font-size: 16px;
        font-weight: 700;
        line-height: 1.15;
        letter-spacing: 0.01em;
      }
      .record p {
        margin: 0;
        font-size: 14px;
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
      <div class="calendar-wrap">
        <table class="calendar" aria-label="Calendário de reservas">
          <thead>
            <tr>${weekdayHeaders.map((label) => `<th>${label}</th>`).join('')}</tr>
          </thead>
          <tbody>
            ${calendarRows}
          </tbody>
        </table>
        <p class="calendar-meta">Cores distintas identificam reservas. Célula diagonal indica troca no mesmo dia.</p>
      </div>
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
  const [backupLoading, setBackupLoading] = useState(false)
  const [backupPreparing, setBackupPreparing] = useState(false)
  const [backupImporting, setBackupImporting] = useState(false)
  const [backupError, setBackupError] = useState<string | null>(null)
  const [backupPreview, setBackupPreview] = useState<BackupImportPreview | null>(null)
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
  const backupFileInputRef = useRef<HTMLInputElement | null>(null)

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

  const openPanel = (mode: PanelMode) => {
    setMenuOpen(false)
    setPendingPdfExport(null)
    setPdfFileName('')
    setPdfDialogError(null)
    setPanelMode(mode)
    setConsultOpen(true)
    setConsultError(null)
    setExportError(null)
    setBackupError(null)
    setBackupPreview(null)
  }

  const handleOpenConsult = () => {
    openPanel('consult')
  }

  const handleOpenVisualize = () => {
    openPanel('visualize')
  }

  const handleOpenExport = () => {
    openPanel('export')
  }

  const handleOpenPrint = () => {
    openPanel('print')
  }

  const handleOpenBackup = () => {
    openPanel('backup')
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
    setPendingPdfExport(null)
    setPdfFileName('')
    setPdfDialogError(null)
  }

  const handleConsult = async () => {
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

  const handleVisualizeExport = async () => {
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
    setPendingPdfExport(null)
    setPdfDialogError(null)
    setPdfFileName('')
  }

  const handleBackupDownload = async () => {
    setBackupError(null)
    setNotice(null)
    setBackupLoading(true)
    try {
      const stays = await listStays({})
      const rows = toBackupRows(stays)
      const fileName = buildBackupZipFileName()
      const csvFileName = buildBackupFileName('csv')
      const jsonFileName = buildBackupFileName('json')
      const zipBlob = buildBackupZipBlob([
        { name: csvFileName, content: buildBackupCsv(rows) },
        { name: jsonFileName, content: JSON.stringify(rows, null, 2) },
      ])
      downloadBlob(zipBlob, fileName)
      setNotice(`Backup ZIP gerado com ${rows.length} registos.`)
    } catch (error) {
      logError('Erro ao gerar backup local', error)
      setBackupError(toPublicErrorMessage(error, 'Não foi possível gerar o backup local.'))
    } finally {
      setBackupLoading(false)
    }
  }

  const handleRequestBackupImport = () => {
    setBackupError(null)
    if (backupPreparing || backupImporting) return
    backupFileInputRef.current?.click()
  }

  const handleCancelBackupPreview = () => {
    if (backupPreparing || backupImporting) return
    setBackupPreview(null)
    setBackupError(null)
  }

  const handleBackupImportFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    event.target.value = ''
    if (!file) return

    setBackupError(null)
    setNotice(null)
    setBackupPreparing(true)
    setBackupPreview(null)

    try {
      const rows = await extractRowsFromBackupZip(file)
      if (rows.length === 0) {
        setBackupError('O ficheiro não contém registos para importar.')
        return
      }

      const existing = await listStays({})
      const existingKeySet = new Set(
        existing.map((stay) =>
          [
            stay.apartment_id,
            stay.guest_name.trim().toLowerCase(),
            stay.guest_phone.trim(),
            stay.check_in ?? '',
            stay.check_out ?? '',
          ].join('|'),
        ),
      )

      const apartmentIdByName = new Map(
        apartments.map((apartment) => [apartment.name.trim().toLowerCase(), apartment.id]),
      )

      let duplicateCount = 0
      let invalidCount = 0
      const invalidEntries: BackupInvalidRow[] = []
      const payloads: StayInput[] = []

      for (const [rowIndex, row] of rows.entries()) {
        const registerInvalid = (reason: string) => {
          invalidCount += 1
          if (invalidEntries.length < 25) {
            invalidEntries.push({
              rowNumber: rowIndex + 2,
              guestName: row.guest_name?.trim() || '(sem nome)',
              apartmentName: row.apartment_name?.trim() || '(sem apartamento)',
              reason,
            })
          }
        }

        const apartmentId =
          apartments.some((apartment) => apartment.id === row.apartment_id)
            ? row.apartment_id
            : apartmentIdByName.get(row.apartment_name.trim().toLowerCase()) ?? null

        if (!apartmentId) {
          registerInvalid('Apartamento não encontrado.')
          continue
        }

        const guestName = row.guest_name.trim()
        const guestPhone = row.guest_phone.trim()
        const guestEmail = row.guest_email.trim()
        const guestAddress = row.guest_address.trim()
        const checkIn = row.check_in.trim()
        const checkOut = row.check_out.trim()
        const amountPaid =
          row.amount_paid === null || row.amount_paid === undefined ? null : Number(row.amount_paid)

        const fieldErrors: string[] = []
        if (guestName.length < 2) fieldErrors.push('Nome inválido')
        if (guestPhone.length < 6) fieldErrors.push('Telefone inválido')
        if (guestEmail.length < 3) fieldErrors.push('Email inválido')
        if (guestAddress.length < 3) fieldErrors.push('Morada inválida')
        if (amountPaid !== null && (!Number.isFinite(amountPaid) || amountPaid < 0)) {
          fieldErrors.push('Valor pago inválido')
        }
        if (fieldErrors.length > 0) {
          registerInvalid(fieldErrors.join(', ') + '.')
          continue
        }

        if ((checkIn && !checkOut) || (!checkIn && checkOut)) {
          registerInvalid('Datas incompletas (entrada/saída).')
          continue
        }

        if (checkIn && checkOut) {
          const nights = calculateNights(checkIn, checkOut)
          if (!nights || nights <= 0) {
            registerInvalid('Datas inválidas (noites <= 0).')
            continue
          }
        }

        const key = [apartmentId, guestName.toLowerCase(), guestPhone, checkIn, checkOut].join('|')
        if (existingKeySet.has(key)) {
          duplicateCount += 1
          continue
        }

        const year = Number.isFinite(row.year) && row.year > 0
          ? row.year
          : checkIn
            ? parseDateSafe(checkIn)?.getFullYear() ?? currentYear
            : currentYear
        const calculatedNights = checkIn && checkOut ? calculateNights(checkIn, checkOut) ?? row.nights_count : row.nights_count
        const nightsCount = Number.isFinite(calculatedNights) && calculatedNights > 0 ? calculatedNights : 1

        const payload: StayInput = {
          guest_name: guestName,
          guest_phone: guestPhone,
          guest_email: guestEmail,
          guest_address: guestAddress,
          apartment_id: apartmentId,
          people_count: Number.isFinite(row.people_count) && row.people_count > 0 ? row.people_count : 1,
          nights_count: nightsCount,
          amount_paid: amountPaid,
          linen: row.linen === 'Sem Roupa' ? 'Sem Roupa' : 'Com Roupa',
          rating: null,
          notes: row.notes?.trim() ? row.notes.trim() : null,
          check_in: checkIn || null,
          check_out: checkOut || null,
          year,
        }

        payloads.push(payload)
        existingKeySet.add(key)
      }

      setBackupPreview({
        fileName: file.name,
        totalRows: rows.length,
        readyRows: payloads.length,
        duplicateRows: duplicateCount,
        invalidRows: invalidCount,
        invalidEntries,
        payloads,
      })
      if (payloads.length > 0) {
        setNotice(`Pré-visualização pronta: ${payloads.length} registos prontos para importar.`)
      } else {
        setBackupError('Não existem registos novos válidos para importar neste backup.')
      }
    } catch (error) {
      logError('Erro ao importar backup', error)
      setBackupError(toPublicErrorMessage(error, 'Não foi possível importar o backup.'))
    } finally {
      setBackupPreparing(false)
    }
  }

  const handleConfirmBackupImport = async () => {
    if (!backupPreview) return

    setBackupError(null)
    setNotice(null)
    setBackupImporting(true)
    try {
      let importedCount = 0
      let failedCount = 0

      for (const payload of backupPreview.payloads) {
        try {
          await createStay(payload)
          importedCount += 1
        } catch {
          failedCount += 1
        }
      }

      setNotice(
        `Importação concluída: ${importedCount} importados, ${backupPreview.duplicateRows} duplicados, ${backupPreview.invalidRows} inválidos, ${failedCount} falhados.`,
      )
      setBackupPreview(null)
    } catch (error) {
      logError('Erro ao confirmar importação de backup', error)
      setBackupError(toPublicErrorMessage(error, 'Não foi possível concluir a importação do backup.'))
    } finally {
      setBackupImporting(false)
    }
  }

  const handleOpenConsultResult = (stay: StayWithApartment) => {
    setConsultOpen(false)
    handleOpenSearchResult(stay)
  }

  const isConsultMode = panelMode === 'consult'
  const isVisualizeMode = panelMode === 'visualize'
  const isExportMode = panelMode === 'export'
  const isBackupMode = panelMode === 'backup'

  const handlePanelSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (isConsultMode) {
      void handleConsult()
      return
    }
    if (isVisualizeMode) {
      void handleVisualizeExport()
      return
    }
    if (isExportMode) {
      void handleExportDocument('pdf')
      return
    }
    if (isBackupMode) {
      return
    }
    void handleExportDocument('print')
  }

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
                  Editar
                </button>
                <button type="button" role="menuitem" onClick={handleOpenVisualize}>
                  Visualizar
                </button>
                <button type="button" role="menuitem" onClick={handleOpenExport}>
                  Exportar
                </button>
                <button type="button" role="menuitem" onClick={handleOpenPrint}>
                  Imprimir
                </button>
                <button type="button" role="menuitem" onClick={handleOpenBackup}>
                  Backup
                </button>
              </div>
            )}
          </div>
        </div>

        {consultOpen && (
          <div className="consult-panel">
            <div className="consult-panel-header">
              <div>
                <h2>
                  {isConsultMode
                    ? 'Consultar registos'
                    : isVisualizeMode
                      ? 'Visualizar registos'
                      : isExportMode
                        ? 'Exportar registos'
                        : isBackupMode
                          ? 'Backup local'
                          : 'Imprimir registos'}
                </h2>
                <p>
                  {isConsultMode
                    ? 'Filtra por apartamento, ano e mês.'
                    : isVisualizeMode
                      ? 'Filtra por apartamento, ano e mês para visualizar no ecrã.'
                      : isExportMode
                        ? 'Filtra por apartamento, ano e mês para exportar em PDF.'
                        : isBackupMode
                          ? 'Descarrega todos os registos para ficheiro local em CSV ou JSON.'
                          : 'Filtra por apartamento, ano e mês para imprimir.'}
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

            {!isBackupMode && (
              <form className="consult-form" onSubmit={handlePanelSubmit}>
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
                        {isVisualizeMode
                          ? exportLoading
                            ? 'A visualizar...'
                            : 'Visualizar'
                          : isExportMode
                            ? exportLoading
                              ? 'A exportar...'
                              : 'Exportar'
                            : exportLoading
                              ? 'A imprimir...'
                              : 'Imprimir'}
                      </button>
                      <button type="button" className="clear-btn" onClick={handleClearExport}>
                        Limpar
                      </button>
                    </>
                  )}
                </div>
              </form>
            )}

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
            ) : isVisualizeMode ? (
              <>
                {exportError && <p className="error">{exportError}</p>}
                {exportHasRun && (
                  <div className="export-results">
                    <h3>Resultado da visualização</h3>
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
                              {yearGroup.months.map((monthGroup) => {
                                const monthCalendar = buildMonthCalendarView(
                                  monthGroup.stays,
                                  yearGroup.year,
                                  monthGroup.month,
                                )

                                return (
                                  <section
                                    key={`export-month-${yearGroup.year}-${monthGroup.month}`}
                                    className="export-month-group"
                                  >
                                    <h5>
                                      {monthLabelByValue[String(monthGroup.month)] ?? `Mês ${monthGroup.month}`}
                                    </h5>
                                    <div className="visual-calendar-wrap">
                                      <table className="visual-calendar" aria-label="Calendário de reservas">
                                        <thead>
                                          <tr>
                                            {weekdayHeaders.map((label) => (
                                              <th key={`visual-weekday-${yearGroup.year}-${monthGroup.month}-${label}`}>
                                                {label}
                                              </th>
                                            ))}
                                          </tr>
                                        </thead>
                                        <tbody>
                                          {monthCalendar.rows.map((row, rowIndex) => (
                                            <tr key={`visual-row-${yearGroup.year}-${monthGroup.month}-${rowIndex}`}>
                                              {row.map((cell) => (
                                                <td
                                                  key={`visual-cell-${yearGroup.year}-${monthGroup.month}-${cell.key}-${rowIndex}`}
                                                  className={cell.className}
                                                  style={
                                                    cell.paint
                                                      ? { background: cell.paint.background, color: cell.paint.color }
                                                      : undefined
                                                  }
                                                >
                                                  <span className="day-chip">{cell.dayNumber}</span>
                                                </td>
                                              ))}
                                            </tr>
                                          ))}
                                        </tbody>
                                      </table>
                                      <p className="visual-calendar-meta">
                                        Cores distintas identificam reservas. Célula diagonal indica troca no mesmo dia.
                                      </p>
                                    </div>
                                    <ul className="export-client-list">
                                      {monthCalendar.orderedStays.map((stay, index) => {
                                        const stayColor =
                                          monthCalendar.colorByStayId.get(stay.id) ?? getColorForStay(index)

                                        return (
                                          <li key={`export-row-${stay.id}`}>
                                            <div className="export-client-header">
                                              <strong style={{ color: stayColor.border }}>{stay.guest_name}</strong>
                                              <div className="export-client-meta">
                                                <span>{stay.apartment?.name ?? 'Apartamento desconhecido'}</span>
                                                <span
                                                  className="export-client-dot"
                                                  style={{ backgroundColor: stayColor.border }}
                                                  aria-hidden="true"
                                                />
                                              </div>
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
                                                <span>Valor pago:</span> {formatMoneyForDisplay(stay.amount_paid)}
                                              </p>
                                              <p>
                                                <span>Valor/dia:</span>{' '}
                                                {formatMoneyForDisplay(
                                                  calculateAmountPerDay(
                                                    stay.amount_paid,
                                                    calculateNights(stay.check_in ?? '', stay.check_out ?? '') ??
                                                      stay.nights_count,
                                                  ),
                                                )}
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
                                        )
                                      })}
                                    </ul>
                                  </section>
                                )
                              })}
                            </div>
                          </section>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </>
            ) : isBackupMode ? (
              <div className="backup-panel">
                <h3>Backup de todos os registos</h3>
                <p>
                  Descarrega um ZIP com CSV+JSON, ou importa um ZIP de backup para restaurar registos.
                </p>
                {backupError && <p className="error">{backupError}</p>}
                <div className="backup-actions">
                  <button
                    type="button"
                    onClick={() => {
                      void handleBackupDownload()
                    }}
                    disabled={backupLoading || backupPreparing || backupImporting}
                  >
                    {backupLoading ? 'A gerar...' : 'Download Backup'}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      handleRequestBackupImport()
                    }}
                    disabled={backupLoading || backupPreparing || backupImporting}
                  >
                    {backupPreparing ? 'A analisar...' : 'Importar Backup'}
                  </button>
                </div>
                {backupPreview && (
                  <div className="backup-preview">
                    <h4>Pré-visualização da importação</h4>
                    <p><span>Ficheiro:</span> {backupPreview.fileName}</p>
                    <p><span>Total no backup:</span> {backupPreview.totalRows}</p>
                    <p><span>Prontos para importar:</span> {backupPreview.readyRows}</p>
                    <p><span>Duplicados:</span> {backupPreview.duplicateRows}</p>
                    <p><span>Inválidos:</span> {backupPreview.invalidRows}</p>
                    {backupPreview.invalidEntries.length > 0 && (
                      <div className="backup-invalid-list">
                        <p className="backup-invalid-title">Detalhe de inválidos (até 25):</p>
                        <ul>
                          {backupPreview.invalidEntries.map((entry, index) => (
                            <li key={`${entry.rowNumber}-${entry.guestName}-${index}`}>
                              <p className="backup-invalid-head">
                                Linha {entry.rowNumber}: {entry.guestName} ({entry.apartmentName})
                              </p>
                              <p className="backup-invalid-reason">{entry.reason}</p>
                            </li>
                          ))}
                        </ul>
                        {backupPreview.invalidRows > backupPreview.invalidEntries.length && (
                          <p className="backup-invalid-more">
                            +{backupPreview.invalidRows - backupPreview.invalidEntries.length} inválidos não listados.
                          </p>
                        )}
                      </div>
                    )}
                    <div className="backup-actions">
                      <button
                        type="button"
                        onClick={() => {
                          void handleConfirmBackupImport()
                        }}
                        disabled={backupImporting || backupPreview.readyRows === 0}
                      >
                        {backupImporting ? 'A importar...' : 'Confirmar importação'}
                      </button>
                      <button
                        type="button"
                        className="clear-btn"
                        onClick={handleCancelBackupPreview}
                        disabled={backupImporting}
                      >
                        Cancelar
                      </button>
                    </div>
                  </div>
                )}
                <input
                  ref={backupFileInputRef}
                  type="file"
                  accept=".zip,application/zip,application/x-zip-compressed"
                  className="backup-file-input"
                  onChange={(event) => {
                    void handleBackupImportFileChange(event)
                  }}
                />
              </div>
            ) : (
              <>
                {exportError && <p className="error">{exportError}</p>}
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
                        <span>Valor pago:</span> {formatMoneyForDisplay(stay.amount_paid)}
                      </p>
                      <p>
                        <span>Valor/dia:</span>{' '}
                        {formatMoneyForDisplay(
                          calculateAmountPerDay(
                            stay.amount_paid,
                            calculateNights(stay.check_in ?? '', stay.check_out ?? '') ??
                              stay.nights_count,
                          ),
                        )}
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
                Valor pago
                <input
                  type="text"
                  inputMode="decimal"
                  value={form.amount_paid}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, amount_paid: event.target.value }))
                  }
                  placeholder="0,00"
                />
              </label>
              <label>
                Valor por dia
                <input
                  type="text"
                  value={formatMoneyForDisplay(
                    calculateAmountPerDay(
                      form.amount_paid.trim() ? parseMoneyInput(form.amount_paid) : null,
                      calculateNights(form.check_in, form.check_out),
                    ),
                  )}
                  readOnly
                  tabIndex={-1}
                />
              </label>
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
