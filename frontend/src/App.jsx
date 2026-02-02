import Homepage from './pages/Homepage.jsx';
import { Reports } from './pages/Reports.jsx';
import { About } from './pages/About.jsx';
import { CellClassifications } from './pages/CellClassifications.jsx';
import { Simulation } from './pages/Simulation.jsx';
import { Routes, Route } from 'react-router-dom';
import { AnalysisProvider } from './context/AnalysisContext.jsx';

function App() {
  // Hemalyzer App Router
  return (
    <AnalysisProvider>
      <Routes>
        <Route path="/" element={<Homepage />} />
        <Route path="reports" element={<Reports />} />
        <Route path="about" element={<About />} />
        <Route path="classifications" element={<CellClassifications />} />
        <Route path="simulation" element={<Simulation />} />
      </Routes>
    </AnalysisProvider>
  )
}

export default App;