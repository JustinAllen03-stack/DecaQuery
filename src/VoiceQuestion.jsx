import { useEffect, useRef, useState } from 'react';
import { MedplumClient } from '@medplum/core';
import { runAggregation } from './aggregate';

const medplum = new MedplumClient({ fetch: fetch.bind(window) });
const CLIENT_ID = import.meta.env.VITE_MEDPLUM_CLIENT_ID;
const CLIENT_SECRET = import.meta.env.VITE_MEDPLUM_CLIENT_SECRET;
const GROUP_ID = import.meta.env.VITE_GROUP_ID;
const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

function VoiceQuestion() {
  const [name, setName] = useState('');
  const [recStatus, setRecStatus] = useState('idle'); // idle | recording | done | error
  const [transcript, setTranscript] = useState('');
  const [patientId, setPatientId] = useState(() => {
    return sessionStorage.getItem('decaquery_patientId') || null;
  });

  // [{ id, text, status, myCluster, rank, totalThemes }]
  const [myQuestions, setMyQuestions] = useState(() => {
    try {
      const saved = sessionStorage.getItem('decaquery_myQuestions');
      const parsed = saved ? JSON.parse(saved) : [];
      // An entry saved mid-flight comes back as 'aggregating' with no in-flight
      // call to finish it — that would pin isBusy true and lock the UI forever.
      return parsed.map((q) => (q.status === 'aggregating' ? { ...q, status: 'error' } : q));
    } catch {
      return [];
    }
  });

  const socketRef = useRef(null);
  const recorderRef = useRef(null);

  useEffect(() => {
    if (patientId) sessionStorage.setItem('decaquery_patientId', patientId);
  }, [patientId]);

  useEffect(() => {
    sessionStorage.setItem('decaquery_myQuestions', JSON.stringify(myQuestions));
  }, [myQuestions]);

  function resetSession() {
    sessionStorage.removeItem('decaquery_patientId');
    sessionStorage.removeItem('decaquery_myQuestions');
    setPatientId(null);
    setMyQuestions([]);
  }

  // Serialize submissions — one aggregation call at a time.
  const isBusy = myQuestions.some((q) => q.status === 'aggregating');

  async function startRecording() {
    setTranscript('');
    setRecStatus('recording');

    let stream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err) {
      console.error('Mic permission denied', err);
      setRecStatus('error');
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
      setRecStatus('error');
    };
  }

  function stopRecording() {
    recorderRef.current?.stream.getTracks().forEach((t) => t.stop());
    recorderRef.current?.stop();
    socketRef.current?.close();
    setRecStatus('done');
  }

  function markQuestion(tempId, patch) {
    setMyQuestions((prev) => prev.map((q) => (q.id === tempId ? { ...q, ...patch } : q)));
  }

  async function submitQuestion() {
    if (!transcript.trim()) return;
    const questionText = transcript.trim();
    const tempId = crypto.randomUUID();

    setMyQuestions((prev) => [...prev, { id: tempId, text: questionText, status: 'aggregating' }]);
    setTranscript('');
    setRecStatus('idle'); // reset the recorder UI so they can ask again right away

    // Save first. If this throws, the question was never persisted — say so
    // rather than claiming it's saved, and clear 'aggregating' so isBusy
    // doesn't leave the UI permanently locked.
    let communication;
    try {
      await medplum.startClientLogin(CLIENT_ID, CLIENT_SECRET);

      let currentPatientId = patientId;
      if (!currentPatientId) {
        const patient = await medplum.createResource({
          resourceType: 'Patient',
          name: [{ text: name || 'Anonymous voice patient' }],
        });
        currentPatientId = patient.id;
        setPatientId(currentPatientId);
      }

      communication = await medplum.createResource({
        resourceType: 'Communication',
        status: 'completed',
        subject: { reference: `Patient/${currentPatientId}` },
        about: [{ reference: `Group/${GROUP_ID}` }],
        payload: [{ contentString: questionText }],
      });
    } catch (err) {
      console.error(err);
      markQuestion(tempId, { status: 'save-error' });
      return;
    }

    try {
      // excludeId: this question is already in Medplum, so without it the
      // fetched copy and the appended live transcript both count.
      const result = await runAggregation(medplum, GROUP_ID, questionText, communication.id);
      const sorted = [...result.clusters].sort((a, b) => b.patientCount - a.patientCount);
      // Reference equality is deliberate — runAggregation's .find() returns an
      // entry of this same array, so findIndex still locates it after sorting a copy.
      const rank =
        result.myCluster && result.myCluster !== 'flagged'
          ? sorted.findIndex((c) => c === result.myCluster) + 1
          : null;

      markQuestion(tempId, {
        status: 'done',
        myCluster: result.myCluster,
        rank,
        totalThemes: sorted.length,
      });
    } catch (err) {
      console.error(err);
      markQuestion(tempId, { status: 'error' });
    }
  }

  return (
    <div style={{ padding: 20, maxWidth: 500, margin: '0 auto', fontFamily: 'sans-serif' }}>
      <h2>Ask a question</h2>

      {patientId ? (
        <p style={{ marginBottom: 12 }}>
          Asking as: <strong>{name || 'Anonymous voice patient'}</strong>
        </p>
      ) : (
        <input
          placeholder="Your name (optional)"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={{ width: '100%', padding: 8, marginBottom: 12 }}
        />
      )}

      {recStatus !== 'recording' ? (
        <button onClick={startRecording} disabled={isBusy}>
          🎤 Start speaking
        </button>
      ) : (
        <button onClick={stopRecording}>⏹ Stop</button>
      )}

      {isBusy && (
        <p style={{ color: '#888', fontSize: 13 }}>Finishing your last question first…</p>
      )}

      {recStatus === 'error' && (
        <p style={{ color: '#b00020' }}>
          Mic or connection issue — type your question instead:
        </p>
      )}

      {(recStatus === 'error' || recStatus === 'done') && (
        <textarea
          value={transcript}
          onChange={(e) => setTranscript(e.target.value)}
          placeholder="Your question will appear here — edit if needed"
          style={{ width: '100%', minHeight: 80, marginTop: 12 }}
        />
      )}

      {recStatus === 'recording' && <p><em>{transcript || 'Listening…'}</em></p>}

      {(recStatus === 'done' || recStatus === 'error') && (
        <button onClick={submitQuestion} disabled={!transcript.trim()}>
          Submit question
        </button>
      )}

      <div style={{ marginTop: 30 }}>
        <h3>Your questions this session</h3>
        {myQuestions.length === 0 && <p style={{ color: '#888' }}>Nothing submitted yet.</p>}
        {(myQuestions.length > 0 || patientId) && (
          <button onClick={resetSession} style={{ fontSize: 12, marginBottom: 10 }}>
            Reset session (rehearsal)
          </button>
        )}
        {myQuestions.map((q) => (
          <div key={q.id} style={{ border: '1px solid #444', borderRadius: 8, padding: 10, marginBottom: 8 }}>
            <p style={{ margin: 0 }}>"{q.text}"</p>

            {q.status === 'aggregating' && (
              <p style={{ color: '#888', fontSize: 13 }}>Finding your theme…</p>
            )}

            {q.status === 'save-error' && (
              <p style={{ color: '#b00020', fontSize: 13 }}>
                Couldn't save this one — please try asking it again.
              </p>
            )}

            {q.status === 'error' && (
              <p style={{ color: '#b00020', fontSize: 13 }}>
                Couldn't process this one — it's still saved, just not grouped yet.
              </p>
            )}

            {q.status === 'done' && q.myCluster === 'flagged' && (
              <p style={{ color: '#c66', fontSize: 13 }}>
                Flagged for individual attention — the clinician will address this directly,
                not as part of the group Q&A order.
              </p>
            )}

            {q.status === 'done' && q.myCluster && q.myCluster !== 'flagged' && (
              <p style={{ fontSize: 13 }}>
                Grouped as: <em>"{q.myCluster.synthesizedQuestion}"</em>
                <br />
                Theme {q.rank} of {q.totalThemes} right now, by volume — this can shift as
                more questions come in before Q&A.
              </p>
            )}

            {q.status === 'done' && !q.myCluster && (
              <p style={{ fontSize: 13, color: '#888' }}>Didn't cluster neatly this round.</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default VoiceQuestion;
