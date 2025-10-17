import Homepage from './pages/Homepage.jsx';
import { Reports } from './pages/Reports.jsx';
import { About } from './pages/About.jsx';
import {Routes, Route} from 'react-router-dom';

function App() {
  return(
    <Routes>
      <Route path="/" element={<Homepage />} />
      <Route path="reports" element={<Reports />} />
      <Route path="about" element={<About />} />
    </Routes>
  )
}

export default App;