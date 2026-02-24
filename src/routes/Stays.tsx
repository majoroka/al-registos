import { type FormEvent, useEffect, useState } from 'react'
import { listApartments } from '../data/apartments'
import { createStay, deleteStay, listStays, updateStay } from '../data/stays'
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

  const loadApartments = async () => {
    try {
      const data = await listApartments()
      setApartments(data)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao carregar apartamentos.',
      )
    }
  }

  const loadStays = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const parsedFilters = {
        year: filters.year ? Number(filters.year) : undefined,
        apartmentId: filters.apartmentId
          ? Number(filters.apartmentId)
          : undefined,
      }
      const data = await listStays(parsedFilters)
      setStays(data)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao carregar registos.',
      )
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

    if (!form.apartment_id) {
      setErrorMessage('Seleciona um apartamento.')
      return
    }

    const payload: StayInput = {
      guest_name: form.guest_name.trim(),
      guest_phone: form.guest_phone.trim(),
      guest_email: form.guest_email.trim(),
      guest_address: form.guest_address.trim(),
      apartment_id: Number(form.apartment_id),
      people_count: Number(form.people_count),
      nights_count: Number(form.nights_count),
      linen: form.linen.trim() || null,
      rating: form.rating ? Number(form.rating) : null,
      notes: form.notes.trim() || null,
      year: Number(form.year) || currentYear,
    }

    try {
      if (editingId) {
        await updateStay(editingId, payload)
        setNotice('Registo atualizado.')
      } else {
        await createStay(payload)
        setNotice('Registo criado.')
      }
      setForm(emptyForm)
      setEditingId(null)
      await loadStays()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao guardar registo.',
      )
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
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao eliminar registo.',
      )
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
          />
        </label>
        <label>
          Avaliação
          <input
            type="number"
            min="0"
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
          />
        </label>
        <label>
          Ano
          <input
            type="number"
            value={form.year}
            onChange={(event) =>
              setForm((prev) => ({ ...prev, year: event.target.value }))
            }
            required
          />
        </label>

        <div className="toolbar">
          <button type="submit">
            {editingId ? 'Guardar alterações' : 'Criar registo'}
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
