import { type FormEvent, useEffect, useMemo, useRef, useState } from 'react'
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
  nights_count: string
  linen: string
  rating: string
  notes: string
  year: string
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
  nights_count: '1',
  linen: '',
  rating: '',
  notes: '',
  year: String(currentYear),
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

function toGuestForm(stay: StayWithApartment): GuestForm {
  return {
    guest_name: stay.guest_name,
    guest_phone: stay.guest_phone,
    guest_email: stay.guest_email,
    guest_address: stay.guest_address,
    people_count: String(stay.people_count),
    nights_count: String(stay.nights_count),
    linen: stay.linen ?? '',
    rating: stay.rating === null ? '' : String(stay.rating),
    notes: stay.notes ?? '',
    year: String(stay.year),
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
  const nightsCount = parsePositiveInteger(form.nights_count)
  const year = parseYear(form.year)

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

  if (!nightsCount) {
    return { error: 'Número de noites inválido.' }
  }

  if (!year) {
    return { error: `Ano inválido. Usa um valor entre ${minYear} e ${maxYear}.` }
  }

  const ratingText = form.rating.trim()
  let rating: number | null = null
  if (ratingText) {
    const parsedRating = Number(ratingText)
    if (!Number.isFinite(parsedRating) || parsedRating < 0 || parsedRating > 10) {
      return { error: 'A avaliação deve estar entre 0 e 10.' }
    }
    rating = parsedRating
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
      linen: form.linen.trim() || null,
      rating,
      notes: form.notes.trim() || null,
      year,
    },
  }
}

export default function Apartments() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [stays, setStays] = useState<StayWithApartment[]>([])
  const [selectedApartmentId, setSelectedApartmentId] = useState<number | null>(null)
  const [selectedStayId, setSelectedStayId] = useState<number | null>(null)
  const [editorMode, setEditorMode] = useState<StayEditorMode>(null)
  const [form, setForm] = useState<GuestForm>(emptyForm)
  const [searchQuery, setSearchQuery] = useState('')
  const [menuOpen, setMenuOpen] = useState(false)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loadingApartments, setLoadingApartments] = useState(true)
  const [loadingStays, setLoadingStays] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)

  const selectedApartment = useMemo(
    () => apartments.find((apartment) => apartment.id === selectedApartmentId) ?? null,
    [apartments, selectedApartmentId],
  )

  const selectedStay = useMemo(
    () => stays.find((stay) => stay.id === selectedStayId) ?? null,
    [stays, selectedStayId],
  )

  const filteredStays = useMemo(() => {
    const query = searchQuery.trim().toLowerCase()
    if (!query) return stays

    return stays.filter((stay) => {
      const fields = [
        stay.guest_name,
        stay.guest_email,
        stay.guest_phone,
        stay.guest_address,
        stay.notes ?? '',
        String(stay.year),
      ]

      return fields.some((value) => value.toLowerCase().includes(query))
    })
  }, [searchQuery, stays])

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

  const loadStaysForApartment = async (apartmentId: number) => {
    setLoadingStays(true)
    setErrorMessage(null)
    try {
      const data = await listStays({ apartmentId })
      setStays(data)
    } catch (error) {
      logError('Erro a carregar hóspedes', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao carregar hóspedes.'))
    } finally {
      setLoadingStays(false)
    }
  }

  useEffect(() => {
    void loadApartments()
  }, [])

  const handleSelectApartment = async (apartment: Apartment) => {
    setSelectedApartmentId(apartment.id)
    setSelectedStayId(null)
    setEditorMode(null)
    setSearchQuery('')
    setMenuOpen(false)
    setNotice(null)
    await loadStaysForApartment(apartment.id)
  }

  const handleStartCreate = () => {
    if (!selectedApartmentId) {
      setErrorMessage('Seleciona primeiro um apartamento.')
      return
    }
    setEditorMode('create')
    setForm(emptyForm)
    setMenuOpen(false)
  }

  const handleStartEdit = (stay: StayWithApartment) => {
    setSelectedStayId(stay.id)
    setEditorMode('edit')
    setForm(toGuestForm(stay))
    setMenuOpen(false)
  }

  const handleStartEditSelected = () => {
    if (!selectedStay) {
      setErrorMessage('Seleciona um hóspede para editar.')
      return
    }
    handleStartEdit(selectedStay)
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
      await loadStaysForApartment(selectedApartmentId)
    } catch (error) {
      logError('Erro a guardar registo', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao guardar registo.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteStay = async (stay: StayWithApartment) => {
    const shouldDelete = window.confirm(`Eliminar o registo de "${stay.guest_name}"?`)
    if (!shouldDelete) return

    setErrorMessage(null)
    setNotice(null)
    setDeletingId(stay.id)

    try {
      await deleteStay(stay.id)
      setNotice('Registo eliminado.')

      if (selectedApartmentId) {
        await loadStaysForApartment(selectedApartmentId)
      }

      if (selectedStayId === stay.id) {
        setSelectedStayId(null)
      }
    } catch (error) {
      logError('Erro a eliminar registo', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao eliminar registo.'))
    } finally {
      setDeletingId(null)
    }
  }

  const handleDeleteSelected = async () => {
    if (!selectedStay) {
      setErrorMessage('Seleciona um hóspede para apagar.')
      return
    }
    await handleDeleteStay(selectedStay)
  }

  const handleOpenSearch = () => {
    setMenuOpen(true)
    window.setTimeout(() => {
      searchInputRef.current?.focus()
    }, 0)
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
                  void handleSelectApartment(apartment)
                }}
              >
                <span className="tile-label">Apartamento</span>
                <strong>{apartment.name}</strong>
              </button>
            ))}
          </div>
        )}
      </section>

      {selectedApartment && (
        <section className="guest-board">
          <div className="guest-board-header">
            <div>
              <h2>{selectedApartment.name}</h2>
              <p>
                {filteredStays.length} {filteredStays.length === 1 ? 'hóspede' : 'hóspedes'}
              </p>
            </div>
            <button
              type="button"
              className={`hamburger-btn ${menuOpen ? 'active' : ''}`}
              onClick={() => setMenuOpen((prev) => !prev)}
              aria-label="Abrir ações"
            >
              <span />
              <span />
              <span />
            </button>
          </div>

          {menuOpen && (
            <div className="action-menu">
              <div className="menu-actions">
                <button type="button" onClick={handleStartCreate}>
                  Criar
                </button>
                <button type="button" onClick={handleStartEditSelected} disabled={!selectedStay}>
                  Editar
                </button>
                <button type="button" onClick={() => void handleDeleteSelected()} disabled={!selectedStay}>
                  Apagar
                </button>
                <button type="button" onClick={handleOpenSearch}>
                  Pesquisar
                </button>
              </div>

              <label className="menu-search">
                Pesquisa rápida
                <input
                  ref={searchInputRef}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Nome, email, telefone..."
                />
              </label>
            </div>
          )}

          {notice && <p className="notice">{notice}</p>}
          {errorMessage && <p className="error">{errorMessage}</p>}

          {loadingStays ? (
            <p>A carregar hóspedes...</p>
          ) : filteredStays.length === 0 ? (
            <p className="empty-state">Sem hóspedes para este apartamento.</p>
          ) : (
            <ul className="guest-list">
              {filteredStays.map((stay) => (
                <li
                  key={stay.id}
                  className={`guest-item ${selectedStayId === stay.id ? 'selected' : ''}`}
                  onClick={() => setSelectedStayId(stay.id)}
                >
                  <div className="guest-main">
                    <h3>{stay.guest_name}</h3>
                    <p>{stay.guest_email}</p>
                    <p>{stay.guest_phone}</p>
                  </div>
                  <div className="guest-meta">
                    <span>{stay.nights_count} noites</span>
                    <span>{stay.people_count} pessoas</span>
                    <span>{stay.year}</span>
                  </div>
                  <div className="guest-row-actions">
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        handleStartEdit(stay)
                      }}
                    >
                      Editar
                    </button>
                    <button
                      type="button"
                      disabled={deletingId === stay.id}
                      onClick={(event) => {
                        event.stopPropagation()
                        void handleDeleteStay(stay)
                      }}
                    >
                      {deletingId === stay.id ? 'A apagar...' : 'Apagar'}
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
                Nº Noites
                <input
                  type="number"
                  min="1"
                  max="365"
                  value={form.nights_count}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, nights_count: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Ano
                <input
                  type="number"
                  min={minYear}
                  max={maxYear}
                  value={form.year}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, year: event.target.value }))
                  }
                  required
                />
              </label>
              <label>
                Avaliação
                <input
                  type="number"
                  min="0"
                  max="10"
                  step="0.1"
                  value={form.rating}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, rating: event.target.value }))
                  }
                />
              </label>
              <label>
                Roupa
                <input
                  type="text"
                  value={form.linen}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, linen: event.target.value }))
                  }
                  maxLength={120}
                />
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
