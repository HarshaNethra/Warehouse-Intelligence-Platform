import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Dashboard } from './pages/Dashboard';
import { Incident } from './pages/Incident';
import { LiveMonitoring } from './pages/LiveMonitoring';
import { IncidentLog } from './pages/IncidentLog';
import { Assistant } from './pages/Assistant';
import { Settings } from './pages/Settings';
import { NotFound } from './pages/NotFound';
import { SidebarLayout } from './components/SidebarLayout';
import { ErrorBoundary } from './components/ErrorBoundary';
import { SettingsProvider } from './context/SettingsContext';

function App() {
  return (
    <Router>
      <ErrorBoundary>
        <SettingsProvider>
          <SidebarLayout>
            <Routes>
              <Route path="/" element={<LiveMonitoring />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/incidents" element={<IncidentLog />} />
              <Route path="/assistant" element={<Assistant />} />
              {/* Primary incident route parameter */}
              <Route path="/incident/:eventId" element={<Incident />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </SidebarLayout>
        </SettingsProvider>
      </ErrorBoundary>
    </Router>
  );
}

export default App;
