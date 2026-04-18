import MacOSDesktopMockup from './MediCopilot_macOS_Mockup'
import { LeadProvider } from './lead/LeadContext.jsx'
import { ToastProvider } from './ui/Toast.jsx'
import { TrainingProvider } from './training/TrainingContext.jsx'
import { AdminDashboard } from './training/AdminDashboard.jsx'

function App() {
  const path = window.location.pathname;

  if (path === '/admin') {
    return <AdminDashboard />
  }

  return (
    <ToastProvider>
      <LeadProvider>
        <TrainingProvider>
          <MacOSDesktopMockup />
        </TrainingProvider>
      </LeadProvider>
    </ToastProvider>
  )
}

export default App
