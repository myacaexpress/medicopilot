import MacOSDesktopMockup from './MediCopilot_macOS_Mockup'
import { LeadProvider } from './lead/LeadContext.jsx'

function App() {
  return (
    <LeadProvider>
      <MacOSDesktopMockup />
    </LeadProvider>
  )
}

export default App
