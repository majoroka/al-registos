import { type FormEvent, useEffect, useState } from 'react'
import { listApartments } from '../data/apartments'
import { createStay, deleteStay, listStays, updateStay } from '../data/stays'
import { logError, toPublicErrorMessage } from '../lib/errors'
import type { Apartment, StayInput, StayWithApartment } from '../types'

type StayForm = {
  guest_name: string
  guest_phone: string
  guest_email: string
  guest_address: string
  apartment_id: string
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
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const emptyForm: StayForm = {
  guest_name: '',
  guest_phone: '',
  guest_email: '',
  guest_address: '',
  apartment_id: '',
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

function validateStayForm(form: StayForm): { payload: StayInput } | { error: string } {
  const guestName = form.guest_name.trim()
  const guestPhone = form.guest_phone.trim()
  const guestEmail = form.guest_email.trim().toLowerCase()
  const guestAddress = form.guest_address.trim()
  const apartmentId = parsePositiveInteger(form.apartment_id)
  const peopleCount = parsePositiveInteger(form.people_count)
  const nightsCount = parsePositiveInteger(form.nights_count)
  const year = parseYear(form.year)

  if (guestName.length < 2) {
    return { error: 'O nome do hóspede é obrigatório.' }
  }

  if (!/^[0-9+()\-\s]{6,20}$/.test(guestPhone)) {
    return { error: 'Telefone inválido.' }
  }

  if (!emailPattern.test(guestEmail)) {
    return { error: 'Email inválido.' }
  }

  if (guestAddress.length < 5) {
    return { error: 'A morada é obrigatória.' }
  }

  if (!apartmentId) {
    return { error: 'Seleciona um apartamento válido.' }
  }

  if (!peopleCount) {
    return { error: 'Nº de pessoas inválido.' }
  }

  if (!nightsCount) {
    return { error: 'Nº de noites inválido.' }
  }

  if (!year) {
    return { error: `O ano deve estar entre ${minYear} e ${maxYear}.` }
  }

  const ratingValue = form.rating.trim()
  let rating: number | null = null
  if (ratingValue) {
    const parsedRating = Number(ratingValue)
    if (
      !Number.isFinite(parsedRating) ||
      parsedRating < 0 ||
      parsedRating > 10
    ) {
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

export default function Stays() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [stays, setStays] = useState<StayWithApartment[]>([])
  const [form, setForm] = useState<StayForm>(emptyForm)
  const [filters, setFilters] = useState({
    year: String(currentYear),
    apartmentId: '',
  })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  const loadApartments = async () => {
    try {
      const data = await listApartments()
      setApartments(data)
    } catch (error) {
      logError('Erro a carregar apartamentos', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao carregar apartamentos.'))
    }
  }

  const loadStays = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const yearFilter = filters.year.trim()
      const apartmentIdFilter = filters.apartmentId.trim()
      const parsedYear = yearFilter ? parseYear(yearFilter) : null
      const parsedApartmentId = apartmentIdFilter
        ? parsePositiveInteger(apartmentIdFilter)
        : null

      if (yearFilter && !parsedYear) {
        setErrorMessage(`Ano inválido. Usa um valor entre ${minYear} e ${maxYear}.`)
        setLoading(false)
        return
      }

      if (apartmentIdFilter && !parsedApartmentId) {
        setErrorMessage('Apartamento inválido no filtro.')
        setLoading(false)
        return
      }

      const parsedFilters = {
        year: parsedYear ?? undefined,
        apartmentId: parsedApartmentId ?? undefined,
      }
      const data = await listStays(parsedFilters)
      setStays(data)
    } catch (error) {
      logError('Erro a carregar registos', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao carregar registos.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadApartments()
    void loadStays()
  }, [])

  const handleFilterSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    await loadStays()
  }

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setNotice(null)

    const validated = validateStayForm(form)
    if ('error' in validated) {
      setErrorMessage(validated.error)
      return
    }

    setSubmitting(true)
    try {
      if (editingId) {
        await updateStay(editingId, validated.payload)
        setNotice('Registo atualizado.')
      } else {
        await createStay(validated.payload)
        setNotice('Registo criado.')
      }
      setForm(emptyForm)
      setEditingId(null)
      await loadStays()
    } catch (error) {
      logError('Erro ao guardar registo', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao guardar registo.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleEdit = (stay: StayWithApartment) => {
    setEditingId(stay.id)
    setForm({
      guest_name: stay.guest_name ?? '',
      guest_phone: stay.guest_phone ?? '',
      guest_email: stay.guest_email ?? '',
      guest_address: stay.guest_address ?? '',
      apartment_id: stay.apartment_id ? String(stay.apartment_id) : '',
      people_count: stay.people_count ? String(stay.people_count) : '1',
      nights_count: stay.nights_count ? String(stay.nights_count) : '1',
      linen: stay.linen ?? '',
      rating: stay.rating !== null && stay.rating !== undefined ? String(stay.rating) : '',
      notes: stay.notes ?? '',
      year: stay.year ? String(stay.year) : String(currentYear),
    })
  }

  const handleDelete = async (stayId: number) => {
    const shouldDelete = window.confirm('Eliminar este registo?')
    if (!shouldDelete) return

    setErrorMessage(null)
    setNotice(null)
    try {
      await deleteStay(stayId)
      setNotice('Registo eliminado.')
      await loadStays()
    } catch (error) {
      logError('Erro ao eliminar registo', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao eliminar registo.'))
    }
  }

  const handleCancelEdit = () => {
    setEditingId(null)
    setForm(emptyForm)
  }

  return (
    <section>
      <h1>Registos / Estadias</h1>

      <form onSubmit={handleFilterSubmit}>
        <h2>Filtros</h2>
        <div className="toolbar">
          <label>
            Ano
            <input
              type="number"
              min={minYear}
              max={maxYear}
              value={filters.year}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, year: event.target.value }))
              }
            />
          </label>
          <label>
            Apartamento
            <select
              value={filters.apartmentId}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  apartmentId: event.target.value,
                }))
              }
            >
              <option value="">Todos</option>
              {apartments.map((apartment) => (
                <option key={apartment.id} value={apartment.id}>
                  {apartment.name}
                </option>
              ))}
            </select>
          </label>
          <button type="submit">Aplicar filtros</button>
        </div>
      </form>

      <form onSubmit={handleSubmit}>
        <h2>{editingId ? 'Editar registo' : 'Novo registo'}</h2>
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
              setForm((prev) => ({
                ...prev,
                guest_address: event.target.value,
              }))
            }
            minLength={5}
            maxLength={200}
            required
          />
        </label>
        <label>
          Apartamento
          <select
            value={form.apartment_id}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, apartment_id: event.target.value }))
            }
            required
          >
            <option value="">Seleciona</option>
            {apartments.map((apartment) => (
              <option key={apartment.id} value={apartment.id}>
                {apartment.name}
              </option>
            ))}
          </select>
        </label>
        <label>
          Nº Pessoas
          <input
            type="number"
            min="1"
            max="99"
            value={form.people_count}
            onChange={(event) =>
              setForm((prev) => ({
                ...prev,
                people_count: event.target.value,
              }))
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
              setForm((prev) => ({
                ...prev,
                nights_count: event.target.value,
              }))
            }
            required
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
          Notas
          <textarea
            value={form.notes}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, notes: event.target.value }))
            }
            maxLength={1000}
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

        <div className="toolbar">
          <button type="submit" disabled={submitting}>
            {submitting
              ? 'A guardar...'
              : editingId
                ? 'Guardar alterações'
                : 'Criar registo'}
          </button>
          {editingId && (
            <button type="button" onClick={handleCancelEdit}>
              Cancelar edição
            </button>
          )}
        </div>
      </form>

      {notice && <p className="notice">{notice}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}

      {loading ? (
        <p>A carregar...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Hóspede</th>
              <th>Apartamento</th>
              <th>Ano</th>
              <th>Noites</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {stays.map((stay) => (
              <tr key={stay.id}>
                <td>{stay.guest_name}</td>
                <td>{stay.apartment?.name ?? '-'}</td>
                <td>{stay.year}</td>
                <td>{stay.nights_count}</td>
                <td>
                  <div className="toolbar">
                    <button type="button" onClick={() => handleEdit(stay)}>
                      Editar
                    </button>
                    <button type="button" onClick={() => handleDelete(stay.id)}>
                      Apagar
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
