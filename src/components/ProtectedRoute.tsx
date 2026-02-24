import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({
  children,
}: {
  children: React.ReactNode
}) {
  const { session, loading } = useAuth()

  if (loading) {
    return <p>A carregar sessão...</p>
  }

  if (!session) {
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
