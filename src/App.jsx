import { useState } from 'react'
import VoiceQuestion from './VoiceQuestion'
import ClinicianView from './ClinicianView'

const tabStyle = (active) => ({
  padding: '8px 16px',
  border: 'none',
  borderBottom: active ? '2px solid #2563eb' : '2px solid transparent',
  background: 'none',
  fontWeight: active ? 600 : 400,
  cursor: 'pointer',
})

function App() {
  const [tab, setTab] = useState('patient')

  return (
    <div style={{ fontFamily: 'sans-serif' }}>
      <nav
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 8,
          borderBottom: '1px solid #ddd',
        }}
      >
        <button style={tabStyle(tab === 'patient')} onClick={() => setTab('patient')}>
          Patient
        </button>
        <button style={tabStyle(tab === 'clinician')} onClick={() => setTab('clinician')}>
          Clinician
        </button>
      </nav>

      {tab === 'patient' ? <VoiceQuestion /> : <ClinicianView />}
    </div>
  )
}

export default App
