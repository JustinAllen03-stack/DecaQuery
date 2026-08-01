import { useState } from 'react'
import MeetingShell from './MeetingShell'
import VoiceQuestion from './VoiceQuestion'
import ClinicianView from './ClinicianView'
import FaqPage from './FaqPage'
import PortalTab from './PortalTab'
import PersonaQuestions from './PersonaQuestions'
import { loadAccount, saveAccount } from './personas'
import { useVoiceRecorder } from './useVoiceRecorder'

function App() {
  const view = new URLSearchParams(window.location.search).get('view') || 'patient'
  const [panelTab, setPanelTab] = useState('qa')
  const [faqFocus, setFaqFocus] = useState(null)

  // Persona/account selection is shared with the Portal tab's picker via
  // sessionStorage, so the two can never disagree about who "you" are.
  const [account, setAccountState] = useState(loadAccount)

  function setAccount(next) {
    saveAccount(next)
    setAccountState(next)
  }

  // Lives here so the meeting control bar's mic button, the "You" tile, and the
  // panel all drive and read the same recorder.
  const recorder = useVoiceRecorder()

  // Standalone FAQ page — kept working for direct links / a full-screen beat.
  if (view === 'faq') return <FaqPage />

  // `clinician` is the only accepted value for the clinician panel — the URL is
  // the single source of truth for a tab's role, so the two-tab demo works.
  const role = view === 'clinician' ? 'clinician' : 'patient'

  function openFaq(entryId) {
    setFaqFocus(entryId)
    setPanelTab('faq')
  }

  function panelContent() {
    if (panelTab === 'faq') return <FaqPage embedded focusId={faqFocus} />
    if (panelTab === 'portal') return <PortalTab account={account} setAccount={setAccount} />
    if (role === 'clinician') return <ClinicianView />
    // A seeded persona is a read-only viewing lens; the recorder belongs to the
    // live "yourself" identity only.
    if (account === 'maria' || account === 'sam') {
      return <PersonaQuestions personaKey={account} onOpenPortal={() => setPanelTab('portal')} />
    }
    return <VoiceQuestion recorder={recorder} onOpenFaq={openFaq} />
  }

  return (
    <MeetingShell
      role={role}
      recorder={recorder}
      panelTab={panelTab}
      setPanelTab={setPanelTab}
      account={account}
      setAccount={setAccount}
    >
      {panelContent()}
    </MeetingShell>
  )
}

export default App
