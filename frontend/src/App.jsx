import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Layout from './components/Layout/Layout'
import Dashboard from './pages/Dashboard/Dashboard'
import Automations from './pages/Automations/Automations'
import Contacts from './pages/Contacts/Contacts'
import Messages from './pages/Messages/Messages'
import Logs from './pages/Logs/Logs'
import Settings from './pages/Settings/Settings'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard" element={<Dashboard />} />
          <Route path="automations" element={<Automations />} />
          <Route path="contacts" element={<Contacts />} />
          <Route path="messages" element={<Messages />} />
          <Route path="logs" element={<Logs />} />
          <Route path="settings" element={<Settings />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}

export default App
