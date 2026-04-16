import MacOSDesktopMockup from './MediCopilot_macOS_Mockup'
import { LeadProvider } from './lead/LeadContext.jsx'
import { ToastProvider } from './ui/Toast.jsx'

function App() {
  return (
    <ToastProvider>
      <LeadProvider>
        <MacOSDesktopMockup />
      </LeadProvider>
    </ToastProvider>
  )
}

export default App
