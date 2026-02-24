import { type FormEvent, useEffect, useState } from 'react'
import {
  createApartment,
  deleteApartment,
  listApartments,
} from '../data/apartments'
import { logError, toPublicErrorMessage } from '../lib/errors'
import type { Apartment } from '../types'

export default function Apartments() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [name, setName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const loadApartments = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await listApartments()
      setApartments(data)
    } catch (error) {
      logError('Erro a carregar apartamentos', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao carregar apartamentos.'))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadApartments()
  }, [])

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)
    setNotice(null)

    const normalizedName = name.trim()
    if (normalizedName.length < 2) {
      setErrorMessage('O nome do apartamento deve ter pelo menos 2 caracteres.')
      return
    }

    if (normalizedName.length > 80) {
      setErrorMessage('O nome do apartamento não pode ter mais de 80 caracteres.')
      return
    }

    setSubmitting(true)
    try {
      await createApartment(normalizedName)
      setName('')
      setNotice('Apartamento criado com sucesso.')
      await loadApartments()
    } catch (error) {
      logError('Erro a criar apartamento', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao criar apartamento.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (apartment: Apartment) => {
    const shouldDelete = window.confirm(
      `Eliminar o apartamento "${apartment.name}"?`,
    )
    if (!shouldDelete) return

    setErrorMessage(null)
    setNotice(null)
    setDeletingId(apartment.id)

    try {
      await deleteApartment(apartment.id)
      setNotice('Apartamento eliminado.')
      await loadApartments()
    } catch (error) {
      logError('Erro a eliminar apartamento', error)
      setErrorMessage(toPublicErrorMessage(error, 'Erro ao eliminar apartamento.'))
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <section>
      <h1>Apartamentos</h1>

      <form onSubmit={handleCreate}>
        <label>
          Nome do apartamento
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            maxLength={80}
            required
          />
        </label>
        <button type="submit" disabled={submitting}>
          {submitting ? 'A criar...' : 'Criar'}
        </button>
      </form>

      {notice && <p className="notice">{notice}</p>}
      {errorMessage && <p className="error">{errorMessage}</p>}

      {loading ? (
        <p>A carregar...</p>
      ) : (
        <table>
          <thead>
            <tr>
              <th>Nome</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {apartments.map((apartment) => (
              <tr key={apartment.id}>
                <td>{apartment.name}</td>
                <td>
                  <button
                    type="button"
                    onClick={() => handleDelete(apartment)}
                    disabled={deletingId === apartment.id}
                  >
                    {deletingId === apartment.id ? 'A eliminar...' : 'Eliminar'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
