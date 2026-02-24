import { Link, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Apartments from './routes/Apartments'
import AuthCallback from './routes/AuthCallback'
import Login from './routes/Login'

export default function App() {
  const { session, signOut } = useAuth()

  return (
    <div className="container">
      {session && (
        <header className="app-header">
          <Link to="/apartments" className="brand">
            AL Registo
          </Link>
          <button type="button" onClick={signOut} className="logout-btn">
            Logout
          </button>
        </header>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="/auth/callback" element={<AuthCallback />} />
        <Route
          path="/apartments"
          element={
            <ProtectedRoute>
              <Apartments />
            </ProtectedRoute>
          }
        />
        <Route path="/stays" element={<Navigate to="/apartments" replace />} />
        <Route
          path="*"
          element={<Navigate to={session ? '/apartments' : '/login'} replace />}
        />
      </Routes>
    </div>
  )
}
