import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Incident } from './pages/Incident';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { IncidentLog } from './pages/IncidentLog';
import { Assistant } from './pages/Assistant';
import { ModelEvaluation } from './pages/ModelEvaluation';
import { LoadingBays } from './pages/LoadingBays';
import { BehaviourLibrary } from './pages/BehaviourLibrary';
import { Settings } from './pages/Settings';
import { Login } from './pages/Login';
import { NotFound } from './pages/NotFound';
import { SidebarLayout } from './components/SidebarLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { ProtectedRoute } from './components/ProtectedRoute';
import { SettingsProvider } from './context/SettingsContext';
import { AuthProvider } from './context/AuthContext';
import { ProvenanceProvider } from './context/ProvenanceContext';

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <AuthProvider>
          <SettingsProvider>
            <ProvenanceProvider>
            <Routes>
              {/* Public Login Route */}
              <Route path="/login" element={<Login />} />

              {/* Protected Platform Workspace */}
              <Route
                path="/*"
                element={
                  <ProtectedRoute>
                    <SidebarLayout>
                      <Routes>
                        <Route path="/" element={<LiveMonitoring />} />
                        <Route path="/videos" element={<LiveMonitoring />} />
                        <Route path="/dashboard" element={<Dashboard />} />
                        <Route path="/incidents" element={<IncidentLog />} />
                        <Route path="/loading-bays" element={<LoadingBays />} />
                        <Route path="/behaviour-library" element={<BehaviourLibrary />} />
                        <Route path="/assistant" element={<Assistant />} />
                        <Route path="/model-evaluation" element={<ModelEvaluation />} />
                        {/* Incident detail routes */}
                        <Route path="/incident/:eventId" element={<Incident />} />
                        <Route path="/incidents/:id" element={<Incident />} />
                        <Route path="/settings" element={<Settings />} />
                        <Route path="*" element={<NotFound />} />
                      </Routes>
                    </SidebarLayout>
                  </ProtectedRoute>
                }
              />
            </Routes>
            </ProvenanceProvider>
          </SettingsProvider>
        </AuthProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
