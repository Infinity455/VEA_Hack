
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useRef,
  useState
} from "react";

import * as Tone from "tone";

import {
  initializeAudio,
  playLoopNote,
  stopAllLoopNotes
} from "../piano/Audio.js";

import "./LoopStation.css";

const LoopStation = forwardRef(function LoopStation(_, ref) {
  const [mode, setMode] = useState("idle");
  const [events, setEvents] = useState([]);
  const [duration, setDuration] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [error, setError] = useState("");

  const modeRef = useRef("idle");
  const eventsRef = useRef([]);
  const pendingRef = useRef(new Map());
  const recordingStartRef = useRef(0);
  const loopDurationRef = useRef(0);
  const partRef = useRef(null);
  const tickerRef = useRef(null);
  const nextIdRef = useRef(0);

  // Called by piano.jsx whenever a note starts or stops.
  useImperativeHandle(ref, () => ({
    onNoteEvent(note, action) {
      if (modeRef.current !== "recording") return;

      const position = Math.max(
        0,
        (performance.now() - recordingStartRef.current) / 1000
      );

      if (action === "start") {
        if (!pendingRef.current.has(note)) {
          pendingRef.current.set(note, position);
        }
      }

      if (action === "stop") {
        const start = pendingRef.current.get(note);
        if (start === undefined) return;

        pendingRef.current.delete(note);

        const event = {
          id: ++nextIdRef.current,
          note,
          start,
          duration: Math.max(0.07, position - start)
        };

        eventsRef.current.push(event);
        setEvents([...eventsRef.current]);
      }
    }
  }), []);

  function clearTicker() {
    if (tickerRef.current !== null) {
      window.clearInterval(tickerRef.current);
      tickerRef.current = null;
    }
  }

  const stopPlayback = useCallback(() => {
    Tone.Transport.stop();

    if (partRef.current) {
      partRef.current.stop();
      partRef.current.dispose();
      partRef.current = null;
    }

    Tone.Transport.position = 0;
    stopAllLoopNotes();
  }, []);

  async function startRecording() {
    try {
      setError("");
      await initializeAudio();

      stopPlayback();
      clearTicker();

      eventsRef.current = [];
      pendingRef.current.clear();
      loopDurationRef.current = 0;

      setEvents([]);
      setDuration(0);
      setElapsed(0);

      recordingStartRef.current = performance.now();

      modeRef.current = "recording";
      setMode("recording");

      tickerRef.current = window.setInterval(() => {
        setElapsed(
          (performance.now() - recordingStartRef.current) / 1000
        );
      }, 100);
    } catch (err) {
      console.error("Loop recording failed:", err);
      setError("Could not start audio recording.");
    }
  }

  function finishRecording() {
    if (modeRef.current !== "recording") return;

    clearTicker();

    const end = Math.max(
      0.25,
      (performance.now() - recordingStartRef.current) / 1000
    );

    // Finish notes that are still being held.
    for (const [note, start] of pendingRef.current) {
      eventsRef.current.push({
        id: ++nextIdRef.current,
        note,
        start,
        duration: Math.max(0.07, end - start)
      });
    }

    pendingRef.current.clear();

    eventsRef.current.sort((a, b) => a.start - b.start);

    loopDurationRef.current = end;
    setDuration(end);
    setElapsed(0);
    setEvents([...eventsRef.current]);

    modeRef.current = "idle";
    setMode("idle");
  }

  async function startPlayback() {
    if (eventsRef.current.length === 0) return;

    try {
      setError("");
      await initializeAudio();

      stopPlayback();
      clearTicker();

      const scheduledEvents = eventsRef.current.map((event) => [
        event.start,
        {
          note: event.note,
          duration: event.duration
        }
      ]);

      const part = new Tone.Part((time, event) => {
        playLoopNote(event.note, event.duration, time);
      }, scheduledEvents);

      part.loop = true;
      part.loopEnd = loopDurationRef.current;
      part.start(0);

      partRef.current = part;

      Tone.Transport.start("+0.05");

      modeRef.current = "playing";
      setMode("playing");
      setElapsed(0);

      tickerRef.current = window.setInterval(() => {
        const length = loopDurationRef.current || 1;
        setElapsed(Tone.Transport.seconds % length);
      }, 100);
    } catch (err) {
      console.error("Loop playback failed:", err);
      stopPlayback();
      setError("Could not play the loop.");
      modeRef.current = "idle";
      setMode("idle");
    }
  }

  function handleStop() {
    if (modeRef.current === "recording") {
      finishRecording();
      return;
    }

    stopPlayback();
    clearTicker();
    modeRef.current = "idle";
    setMode("idle");
    setElapsed(0);
  }

  function clearLoop() {
    stopPlayback();
    clearTicker();

    eventsRef.current = [];
    pendingRef.current.clear();
    loopDurationRef.current = 0;

    modeRef.current = "idle";
    setMode("idle");
    setEvents([]);
    setDuration(0);
    setElapsed(0);
    setError("");
  }

  useEffect(() => {
    return () => {
      if (tickerRef.current !== null) {
        window.clearInterval(tickerRef.current);
      }

      stopPlayback();
    };
  }, [stopPlayback]);

  const isRecording = mode === "recording";
  const isPlaying = mode === "playing";
  const progress = duration > 0
    ? (elapsed / duration) * 100
    : 0;

  return (
    <section className="loop-station">
      <div className="loop-header">
        <div>
          <div className="loop-heading-row">
            <span className="loop-icon">↻</span>
            <h2>Loop Station</h2>

            <span className={`loop-badge ${mode}`}>
              {isRecording
                ? "● Recording"
                : isPlaying
                  ? "▶ Playing"
                  : "Ready"}
            </span>
          </div>

          <p>
            Record a melody, loop it, and play new notes over it
            using your hands.
          </p>
        </div>

        <div className="loop-duration">
          {isRecording
            ? `${elapsed.toFixed(1)}s`
            : duration > 0
              ? `${duration.toFixed(1)}s loop`
              : "No loop yet"}
        </div>
      </div>

      <div className="loop-controls">
        <button
          type="button"
          className="loop-btn record"
          onClick={startRecording}
          disabled={isRecording}
        >
          <span className="loop-record-dot" />
          Record Loop
        </button>

        <button
          type="button"
          className="loop-btn play"
          onClick={startPlayback}
          disabled={
            isRecording ||
            isPlaying ||
            events.length === 0
          }
        >
          ▶ Play Loop
        </button>

        <button
          type="button"
          className="loop-btn stop"
          onClick={handleStop}
          disabled={!isRecording && !isPlaying}
        >
          ■ Stop
        </button>

        <button
          type="button"
          className="loop-btn clear"
          onClick={clearLoop}
          disabled={
            events.length === 0 &&
            !isRecording &&
            !isPlaying
          }
        >
          Clear
        </button>
      </div>

      <div className="loop-track">
        <div className="loop-track-header">
          <span>Track 01 — Melody</span>
          <span>{events.length} notes</span>
        </div>

        <div className="loop-timeline">
          {events.length === 0 ? (
            <p className="loop-empty">
              Your recorded notes will appear here.
            </p>
          ) : (
            events.map((event, index) => {
              const length = Math.max(
                duration || elapsed,
                0.25
              );

              const left = Math.min(
                99,
                (event.start / length) * 100
              );

              const width = Math.min(
                100 - left,
                Math.max(
                  1.5,
                  (event.duration / length) * 100
                )
              );

              return (
                <div
                  key={event.id}
                  className={
                    index % 2 === 0
                      ? "loop-note purple"
                      : "loop-note blue"
                  }
                  title={`${event.note} • ${event.duration.toFixed(2)}s`}
                  style={{
                    left: `${left}%`,
                    width: `${width}%`,
                    top: `${10 + (index % 3) * 24}px`
                  }}
                >
                  {event.note}
                </div>
              );
            })
          )}

          {isPlaying && (
            <div
              className="loop-playhead"
              style={{ left: `${progress}%` }}
            />
          )}
        </div>

        <div className="loop-track-footer">
          <span>0:00</span>
          <span>
            {isRecording
              ? "Recording..."
              : isPlaying
                ? "Repeating continuously"
                : duration > 0
                  ? "Ready to loop"
                  : "Press Record Loop to begin"}
          </span>
          <span>
            {duration > 0
              ? `${duration.toFixed(1)}s`
              : "0:00"}
          </span>
        </div>
      </div>

      {error && (
        <p className="loop-error" role="alert">
          {error}
        </p>
      )}
    </section>
  );
});

export default LoopStation;
