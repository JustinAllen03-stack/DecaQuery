import { useRef, useState } from 'react';
import { MedplumClient } from '@medplum/core';
import { runAggregation } from './aggregate';

const medplum = new MedplumClient({ fetch: fetch.bind(window) });
const CLIENT_ID = import.meta.env.VITE_MEDPLUM_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_MEDPLUM_CLIENT_SECRET;
const GROUP_ID = import.meta.env.VITE_GROUP_ID;
const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

function VoiceQuestion() {
  const [name, setName] = useState('');
  const [status, setStatus] = useState('idle'); // idle | recording | done | error | aggregating | confirmed
  const [transcript, setTranscript] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [myResult, setMyResult] = useState(null);
  const socketRef = useRef(null);
  const recorderRef = useRef(null);

  async function startRecording() {
    setTranscript('');
    setSubmitted(false);
    setStatus('recording');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Mic permission denied', err);
      setStatus('error');
      return;
    }

    const socket = new WebSocket(
      'wss://api.deepgram.com/v1/listen?model=nova-3&smart_format=true',
      ['token', DEEPGRAM_KEY]
    );
    socketRef.current = socket;

    socket.onopen = () => {
      const recorder = new MediaRecorder(stream);
      recorderRef.current = recorder;
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0 && socket.readyState === 1) {
          socket.send(event.data);
        }
      });
      recorder.start(250);
    };

    socket.onmessage = (message) => {
      try {
        const received = JSON.parse(message.data);
        const text = received.channel?.alternatives?.[0]?.transcript;
        if (text && received.is_final) {
          setTranscript((prev) => (prev ? `${prev} ${text}` : text));
        }
      } catch (err) {
        console.error('Bad message from Deepgram', err);
      }
    };

    socket.onerror = (err) => {
      console.error('Deepgram socket error', err);
      setStatus('error');
    };
  }

  function stopRecording() {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current?.stop();
    socketRef.current?.close();
    setStatus('done');
  }

  async function submitQuestion() {
    if (!transcript.trim()) return;
    await medplum.startClientLogin(CLIENT_ID, CLIENT_SECRET);
    const patient = await medplum.createResource({
      resourceType: 'Patient',
      name: [{ text: name || 'Anonymous voice patient' }],
    });
    const communication = await medplum.createResource({
      resourceType: 'Communication',
      status: 'completed',
      subject: { reference: `Patient/${patient.id}` },
      about: [{ reference: `Group/${GROUP_ID}` }],
      payload: [{ contentString: transcript.trim() }],
    });
    setSubmitted(true);

    setStatus('aggregating');
    try {
      // Pass communication.id so the question we just saved isn't counted twice
      // — once from the fetch, once as the appended live transcript.
      const result = await runAggregation(
        medplum,
        GROUP_ID,
        transcript.trim(),
        communication.id
      );
      setMyResult(result.myCluster);
    } catch (err) {
      console.error(err);
      setMyResult(null);
    }
    setStatus('confirmed');
  }

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Ask a question</h2>
      <input
        placeholder="Your name (optional)"
        value={name}
        onChange={(e) => setName(e.target.value)}
        style={{ width: '100%', padding: 8, marginBottom: 12 }}
      />

      {status !== 'recording' ? (
        <button onClick={startRecording}>🎤 Start speaking</button>
      ) : (
        <button onClick={stopRecording}>⏹ Stop</button>
      )}

      {status === 'error' && (
        <p style={{ color: '#b00020' }}>
          Mic or connection issue — type your question instead:
        </p>
      )}

      {(status === 'error' || status === 'done') && (
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your question will appear here — edit if needed"
          style={{ width: '100%', minHeight: 80, marginTop: 12 }}
        />
      )}

      {status === 'recording' && <p><em>{transcript || 'Listening…'}</em></p>}

      {(status === 'done' || status === 'error') && !submitted && (
        <button onClick={submitQuestion} disabled={!transcript.trim()}>
          Submit question
        </button>
      )}

      {status === 'aggregating' && <p>Finding others who asked something similar…</p>}

      {status === 'confirmed' && myResult === 'flagged' && (
        <p>Your question has been sent directly to the clinician for individual attention.</p>
      )}

      {status === 'confirmed' && myResult && myResult !== 'flagged' && (
        <div style={{ border: '2px solid #2a6', borderRadius: 8, padding: 14, marginTop: 16 }}>
          <p>Your question is being covered along with {myResult.patientCount - 1} other patients, as:</p>
          <strong>"{myResult.synthesizedQuestion}"</strong>
        </div>
      )}

      {status === 'confirmed' && !myResult && (
        <p>Submitted — your question didn't cluster neatly with others this round.</p>
      )}
    </div>
  );
}

export default VoiceQuestion;
