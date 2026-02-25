import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
import { listApartments } from '../data/apartments'
import { createStay, listStays, updateStay } from '../data/stays'
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
)

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

function toGuestForm(stay: StayWithApartment): GuestForm {
  return {
    guest_name: stay.guest_name,
    guest_phone: stay.guest_phone,
    guest_email: stay.guest_email,
    guest_address: stay.guest_address,
    people_count: String(stay.people_count),
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

  if (guestAddress.length < 5) {
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
  const [consultFilters, setConsultFilters] = useState<ConsultFilters>({
    apartmentId: '',
    year: '',
    month: '',
  })
  const [consultResults, setConsultResults] = useState<StayWithApartment[]>([])
  const [consultHasRun, setConsultHasRun] = useState(false)
  const [consultLoading, setConsultLoading] = useState(false)
  const [consultError, setConsultError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [historyReference, setHistoryReference] = useState('')
  const [historyResults, setHistoryResults] = useState<StayWithApartment[]>([])
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadingApartments, setLoadingApartments] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)

  const selectedApartment = useMemo(
    () => apartments.find((apartment) => apartment.id === selectedApartmentId) ?? null,
    [apartments, selectedApartmentId],
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
      const results = allStays.filter((stay) => {
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

  const handleOpenCustomerHistory = async (stay: StayWithApartment) => {
    const phone = stay.guest_phone.trim()
    const email = stay.guest_email.trim().toLowerCase()
    const name = stay.guest_name.trim().toLowerCase()

    if (!phone && !email && !name) {
      setHistoryError('Sem dados suficientes para consultar histórico.')
      setHistoryOpen(true)
      return
    }

    setHistoryReference(phone || email || stay.guest_name)
    setHistoryError(null)
    setHistoryOpen(true)
    setHistoryLoading(true)

    try {
      const allStays = await listStays({})
      const matches = allStays
        .filter((item) => {
          const itemPhone = item.guest_phone.trim()
          const itemEmail = item.guest_email.trim().toLowerCase()
          const itemName = item.guest_name.trim().toLowerCase()

          const phoneMatch = phone && itemPhone === phone
          const emailMatch = email && itemEmail === email
          const fallbackNameMatch = !phone && !email && name && itemName === name

          return phoneMatch || emailMatch || fallbackNameMatch
        })
        .sort((left, right) => {
          const leftTime = left.check_in
            ? new Date(`${left.check_in}T00:00:00`).getTime()
            : Number.NEGATIVE_INFINITY
          const rightTime = right.check_in
            ? new Date(`${right.check_in}T00:00:00`).getTime()
            : Number.NEGATIVE_INFINITY

          if (leftTime !== rightTime) return rightTime - leftTime
          if (left.year !== right.year) return right.year - left.year
          return right.id - left.id
        })

      setHistoryResults(matches)
    } catch (error) {
      logError('Erro ao consultar histórico do cliente', error)
      setHistoryError(toPublicErrorMessage(error, 'Erro ao consultar histórico.'))
      setHistoryResults([])
    } finally {
      setHistoryLoading(false)
    }
  }

  const handleOpenConsult = () => {
    setMenuOpen(false)
    setConsultOpen(true)
    setConsultError(null)
  }

  const handleOpenExport = () => {
    setMenuOpen(false)
    setNotice('Exportar será implementado no próximo passo.')
  }

  const handleConsultFilterChange = (field: keyof ConsultFilters, value: string) => {
    setConsultFilters((prev) => ({ ...prev, [field]: value }))
  }

  const handleConsult = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setConsultError(null)
    setConsultHasRun(true)

    const apartmentId = consultFilters.apartmentId
      ? Number.parseInt(consultFilters.apartmentId, 10)
      : null
    const year = consultFilters.year ? Number.parseInt(consultFilters.year, 10) : null
    const month = consultFilters.month ? Number.parseInt(consultFilters.month, 10) : null

    if (consultFilters.apartmentId && (!apartmentId || apartmentId <= 0)) {
      setConsultError('Apartamento inválido.')
      return
    }

    if (consultFilters.year && (!year || year < filterMinYear || year > filterMaxYear)) {
      setConsultError(`Ano inválido. Usa um valor entre ${filterMinYear} e ${filterMaxYear}.`)
      return
    }

    if (consultFilters.month && (!month || month < 1 || month > 12)) {
      setConsultError('Mês inválido.')
      return
    }

    setConsultLoading(true)
    try {
      const baseResults = await listStays({
        apartmentId: apartmentId ?? undefined,
      })

      const filteredResults = baseResults.filter((stay) => {
        const checkInDate = parseDateSafe(stay.check_in)
        const checkOutDate = parseDateSafe(stay.check_out)
        const yearSource = checkInDate ?? checkOutDate

        const yearMatch =
          year === null
            ? true
            : yearSource
              ? yearSource.getFullYear() === year
              : stay.year === year

        const monthMatch =
          month === null
            ? true
            : [checkInDate, checkOutDate].some(
                (dateCandidate) => dateCandidate !== null && dateCandidate.getMonth() + 1 === month,
              )

        return yearMatch && monthMatch
      })

      setConsultResults(filteredResults)
    } catch (error) {
      logError('Erro na consulta de registos', error)
      setConsultError(toPublicErrorMessage(error, 'Erro ao consultar registos.'))
    } finally {
      setConsultLoading(false)
    }
  }

  const handleClearConsult = () => {
    setConsultFilters({ apartmentId: '', year: '', month: '' })
    setConsultResults([])
    setConsultHasRun(false)
    setConsultError(null)
  }

  const handleOpenConsultResult = (stay: StayWithApartment) => {
    setConsultOpen(false)
    handleOpenSearchResult(stay)
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
                <h2>Consultar registos</h2>
                <p>Filtra por apartamento, ano e mês.</p>
              </div>
              <button
                type="button"
                className="consult-close-btn"
                onClick={() => setConsultOpen(false)}
              >
                Fechar
              </button>
            </div>

            <form className="consult-form" onSubmit={handleConsult}>
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
                <button type="submit" disabled={consultLoading}>
                  {consultLoading ? 'A consultar...' : 'Consultar'}
                </button>
                <button type="button" className="clear-btn" onClick={handleClearConsult}>
                  Limpar
                </button>
              </div>
            </form>

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
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
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
                <h3>Histórico do cliente</h3>
                <p>{historyReference}</p>
              </div>
              <button type="button" onClick={() => setHistoryOpen(false)}>
                Fechar
              </button>
            </div>

            {historyError && <p className="error">{historyError}</p>}

            {historyLoading ? (
              <p>A consultar histórico...</p>
            ) : historyResults.length === 0 ? (
              <p className="empty-state">Sem histórico para este cliente.</p>
            ) : (
              <ul className="history-list">
                {historyResults.map((stay) => (
                  <li key={`history-${stay.id}`}>
                    <div>
                      <strong>{stay.guest_name}</strong>
                      <p>{stay.apartment?.name ?? 'Apartamento desconhecido'}</p>
                      <p>
                        {stay.check_in ?? '-'} → {stay.check_out ?? '-'} ({stay.year})
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
                  minLength={5}
                  maxLength={200}
                  required
                />
              </label>
              <label>
                Check-in
                <input
                  type="date"
                  value={form.check_in}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, check_in: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Check-out
                <input
                  type="date"
                  value={form.check_out}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, check_out: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Nº Pessoas
                <input
                  type="number"
                  min="1"
                  max="99"
                  value={form.people_count}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, people_count: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Roupa
                <select
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
              <p className="stay-nights-preview field-span-2">
                Noites calculadas:{' '}
                <strong>{calculateNights(form.check_in, form.check_out) ?? '-'}</strong>
              </p>
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
