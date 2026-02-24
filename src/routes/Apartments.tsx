import { type FormEvent, useEffect, useState } from 'react'
import { createApartment, listApartments } from '../data/apartments'
import type { Apartment } from '../types'

export default function Apartments() {
  const [apartments, setApartments] = useState<Apartment[]>([])
  const [name, setName] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  const loadApartments = async () => {
    setLoading(true)
    setErrorMessage(null)
    try {
      const data = await listApartments()
      setApartments(data)
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao carregar apartamentos.',
      )
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

    try {
      await createApartment(name.trim())
      setName('')
      setNotice('Apartamento criado com sucesso.')
      await loadApartments()
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : 'Erro ao criar apartamento.',
      )
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
            required
          />
        </label>
        <button type="submit">Criar</button>
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
            </tr>
          </thead>
          <tbody>
            {apartments.map((apartment) => (
              <tr key={apartment.id}>
                <td>{apartment.name}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  )
}
