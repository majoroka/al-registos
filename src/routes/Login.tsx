import { type FormEvent, useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { logError, toPublicErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

export default function Login() {
  const { session } = useAuth()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (session) {
      navigate('/apartments', { replace: true })
    }
  }, [session, navigate])

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setErrorMessage(null)

    const normalizedEmail = email.trim().toLowerCase()
    const trimmedPassword = password.trim()

    if (!normalizedEmail || !trimmedPassword) {
      setErrorMessage('Preenche email e password.')
      return
    }

    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email: normalizedEmail,
      password: trimmedPassword,
    })

    if (error) {
      logError('Erro no login', error)
      setErrorMessage(
        toPublicErrorMessage(error, 'Não foi possível iniciar sessão.'),
      )
    }

    setLoading(false)
  }

  return (
    <section>
      <h1>Login</h1>
      <p>Usa o teu email e password para entrar.</p>

      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
        </label>

        <label>
          Password
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="current-password"
            required
          />
        </label>

        <button type="submit" disabled={loading}>
          {loading ? 'A entrar...' : 'Entrar'}
        </button>
      </form>

      {errorMessage && <p className="error">{errorMessage}</p>}
    </section>
  )
}
