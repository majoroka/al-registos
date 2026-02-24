import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { logError, toPublicErrorMessage } from '../lib/errors'
import { supabase } from '../lib/supabase'

export default function AuthCallback() {
  const navigate = useNavigate()
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const finishAuth = async () => {
      const url = new URL(window.location.href)
      const code = url.searchParams.get('code')
      const oauthError =
        url.searchParams.get('error_description') ?? url.searchParams.get('error')

      if (oauthError) {
        if (isMounted) {
          setErrorMessage('Autenticação GitHub rejeitada ou inválida.')
        }
        return
      }

      if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code)
        if (error) {
          logError('Erro ao trocar code OAuth por sessão', error)
          if (isMounted) {
            setErrorMessage(
              toPublicErrorMessage(error, 'Não foi possível concluir o login com GitHub.'),
            )
          }
          return
        }
      }

      const { data, error } = await supabase.auth.getSession()
      if (error) {
        logError('Erro ao obter sessão após callback OAuth', error)
      }

      if (!isMounted) return

      if (data.session) {
        navigate('/apartments', { replace: true })
        return
      }

      setErrorMessage('Sessão não encontrada após autenticação. Tenta novamente.')
    }

    void finishAuth()

    return () => {
      isMounted = false
    }
  }, [navigate])

  return (
    <section>
      <h1>A concluir autenticação...</h1>
      <p>Estamos a finalizar o login com GitHub.</p>
      {errorMessage && (
        <>
          <p className="error">{errorMessage}</p>
          <p>
            <Link to="/login">Voltar ao login</Link>
          </p>
        </>
      )}
    </section>
  )
}
