import { useRef, useState } from 'react';

const DEEPGRAM_KEY = import.meta.env.VITE_DEEPGRAM_API_KEY;

/**
 * Deepgram streaming transcription. Lifted out of the panel so the meeting
 * control bar's mic button and the "You" participant tile can drive and read
 * the same recorder the panel uses. Behavior is unchanged from before.
 */
export function useVoiceRecorder() {
  const [recStatus, setRecStatus] = useState('idle'); // idle | recording | done | error
  const [transcript, setTranscript] = useState('');
  const socketRef = useRef(null);
  const recorderRef = useRef(null);

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

  function toggleRecording() {
    if (recStatus === 'recording') stopRecording();
    else startRecording();
  }

  function reset() {
    setTranscript('');
    setRecStatus('idle');
  }

  return {
    recStatus,
    transcript,
    setTranscript,
    startRecording,
    stopRecording,
    toggleRecording,
    reset,
  };
}
