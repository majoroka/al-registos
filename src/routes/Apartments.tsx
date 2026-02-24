import { type FormEvent, useEffect, useMemo, useState } from 'react'
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

const currentYear = new Date().getFullYear()
const minYear = 2000
const maxYear = currentYear + 1

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
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadingApartments, setLoadingApartments] = useState(true)
  const [submitting, setSubmitting] = useState(false)

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
    setErrorMessage(null)
    setNotice(null)
    setSelectedStayId(stay.id)
    setSelectedApartmentId(stay.apartment_id)
    setForm(toGuestForm(stay))
    setEditorMode('edit')
  }

  return (
    <>
      <section className="workspace-shell">
        <div className="workspace-intro">
          <h1>Apartamentos</h1>
          <p>Escolhe um apartamento para gerir hóspedes e registos.</p>
        </div>

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
                <strong>{apartment.name}</strong>
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
                    <button
                      type="button"
                      onClick={() => {
                        handleOpenSearchResult(stay)
                      }}
                    >
                      Abrir
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </section>
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
