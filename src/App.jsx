import { BrowserRouter, Routes, Route } from "react-router-dom";
import MacOSDesktopMockup from "./MediCopilot_macOS_Mockup";
import { LeadProvider } from "./lead/LeadContext.jsx";
import { ToastProvider } from "./ui/Toast.jsx";
import { TrainingProvider } from "./training/TrainingContext.jsx";
import { AdminDashboard } from "./training/AdminDashboard.jsx";

function App() {
  return (
    <BrowserRouter>
      <ToastProvider>
        <TrainingProvider>
          <LeadProvider>
            <Routes>
              <Route path="/training/admin" element={<AdminDashboard />} />
              <Route path="*" element={<MacOSDesktopMockup />} />
            </Routes>
          </LeadProvider>
        </TrainingProvider>
      </ToastProvider>
    </BrowserRouter>
  );
}

export default App;
