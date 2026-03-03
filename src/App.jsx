
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import ProfessionalLogin from './ProfessionalLogin';
import StationAdminDashboard from './StationAdminDashboard';
import ManageUsers from './ManageUsers';
import ManageStations from './ManageStations';
import AssignResponder from './AssignResponder';
import Analytics from './Analytics';
import Incidents from './Incidents';
import ActiveReports from './ActiveReports';
import IncidentDetails from './IncidentDetails';
import Map from './Map';
import { AuthProvider, useAuth } from './contexts/AuthContext';


const ProtectedRoute = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return user ? children : <Navigate to="/professional-login" />;
};


const PublicRoute = ({ children }) => {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return !user ? children : <Navigate to="/dashboard" />;
};

function AppContent() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        fontSize: '18px',
        color: '#666'
      }}>
        Loading...
      </div>
    );
  }

  return (
    <Routes>
      {/* Public Routes */}
      <Route
        path="/professional-login"
        element={
          <PublicRoute>
            <ProfessionalLogin />
          </PublicRoute>
        }
      />

      {/* Protected Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <StationAdminDashboard />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manage-users"
        element={
          <ProtectedRoute>
            <ManageUsers />
          </ProtectedRoute>
        }
      />

      <Route
        path="/manage-stations"
        element={
          <ProtectedRoute>
            <ManageStations />
          </ProtectedRoute>
        }
      />

      {/* Catch all */}
      <Route
        path="/"
        element={
          user ? <Navigate to="/dashboard" /> : <Navigate to="/professional-login" />
        }
      />
      <Route
        path="/assign-responder"
        element={
          <ProtectedRoute>
            <AssignResponder />
          </ProtectedRoute>
        }
      />
      <Route
        path="/analytics"
        element={
          <ProtectedRoute>
            <Analytics />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incidents"
        element={
          <ProtectedRoute>
            <Incidents />
          </ProtectedRoute>
        }
      />
      <Route
        path="/active-reports"
        element={
          <ProtectedRoute>
            <ActiveReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/incident-details/:id"
        element={
          <ProtectedRoute>
            <IncidentDetails />
          </ProtectedRoute>
        }
      />
      <Route
        path="/map"
        element={
          <ProtectedRoute>
            <Map />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <Router>
      <AuthProvider>
        <AppContent />
      </AuthProvider>
    </Router>
  );
}

export default App;