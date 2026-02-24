import { Link, Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import { useAuth } from './context/AuthContext'
import Apartments from './routes/Apartments'
import Login from './routes/Login'
import Stays from './routes/Stays'

export default function App() {
  const { session, signOut } = useAuth()

  return (
    <div className="container">
      {session && (
        <nav>
          <Link to="/apartments">Apartamentos</Link>
          <Link to="/stays">Registos</Link>
          <button type="button" onClick={signOut}>
            Logout
          </button>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/apartments"
          element={
            <ProtectedRoute>
              <Apartments />
            </ProtectedRoute>
          }
        />
        <Route
          path="/stays"
          element={
            <ProtectedRoute>
              <Stays />
            </ProtectedRoute>
          }
        />
        <Route
          path="*"
          element={<Navigate to={session ? '/apartments' : '/login'} replace />}
        />
      </Routes>
    </div>
  )
}
