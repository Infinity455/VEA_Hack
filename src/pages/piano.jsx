import { useCallback, useState } from "react";

import { useHandTracking } from "../piano/HandTracking.js";
import { playPianoNote } from "../piano/Auido.js";
import { HAND_NOTES } from "../piano/Notes.js";

import "./Piano.css";

export default function Piano() {
  const [activeNotes, setActiveNotes] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [audioError, setAudioError] = useState("");

  const handleNote = useCallback((note, details = {}) => {
    setAudioError("");

    playPianoNote(note).catch((error) => {
      console.error("Audio playback failed:", error);
      setAudioError("Audio failed. Click a piano key to try again.");
    });

    setActiveNotes((previous) =>
      previous.includes(note) ? previous : [...previous, note]
    );

    window.setTimeout(() => {
      setActiveNotes((previous) =>
        previous.filter((item) => item !== note)
      );
    }, 200);

    setRecentNotes((previous) => [
      ...previous.slice(-9),
      {
        id: `${Date.now()}-${Math.random()}`,
        note,
        side: details.side ?? "Keyboard",
        finger: details.finger ?? "Click"
      }
    ]);
  }, []);

  const {
    videoRef,
    canvasRef,
    status,
    isStarting,
    isTracking,
    handCount,
    startTracking,
    stopTracking
  } = useHandTracking(handleNote);

  function handleKeyClick(note) {
    handleNote(note, {
      side: "Keyboard",
      finger: "Click"
    });
  }

  return (
    <main className="piano-page">
      <header className="piano-header">
        <div>
          <p className="piano-eyebrow">AIR PIANO</p>
          <h1>Play music with your hands.</h1>
          <p className="piano-subtitle">
            Use both hands to play ten notes without touching a
            physical keyboard. Move your fingers downward across
            the yellow line to play.
          </p>
        </div>

        <div className="piano-status">
          <span
            className={`piano-status-dot ${
              handCount > 0 ? "detected" : ""
            }`}
          />
          {handCount === 2
            ? "Both hands detected"
            : handCount === 1
              ? "One hand detected"
              : isStarting
                ? "Starting..."
                : isTracking
                  ? "Looking for hands"
                  : "Camera off"}
        </div>
      </header>

      <section className="piano-layout">
        <div className="piano-card">
          <div className="piano-card-heading">
            <h2>Live Hand Tracking</h2>
            <span>Up to 2 hands</span>
          </div>

          <div className="camera-stage">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
            />

            <canvas
              ref={canvasRef}
              aria-hidden="true"
            />

            {!isTracking && !isStarting && (
              <div className="camera-placeholder">
                <span>📷</span>
                <strong>Your camera will appear here</strong>
                <p>Start the camera to begin playing.</p>
              </div>
            )}

            {isStarting && (
              <div className="camera-placeholder">
                <strong>Loading hand tracking...</strong>
                <p>This may take a few seconds.</p>
              </div>
            )}
          </div>

          <p className="piano-help" role="status">
            {status}
          </p>

          <div className="piano-actions">
            <button
              type="button"
              className="piano-button primary"
              onClick={startTracking}
              disabled={isStarting || isTracking}
            >
              {isStarting ? "Starting..." : "Start Camera"}
            </button>

            <button
              type="button"
              className="piano-button secondary"
              onClick={stopTracking}
              disabled={!isTracking && !isStarting}
            >
              Stop Camera
            </button>
          </div>

          {audioError && (
            <p className="piano-error" role="alert">
              {audioError}
            </p>
          )}
        </div>

        <div className="piano-card">
          <div className="piano-card-heading">
            <h2>Virtual Piano</h2>
            <span>10 notes</span>
          </div>

          <p className="piano-instructions">
            Each finger has its own note. Click a key to test
            the sound, or use the camera to play with your hands.
          </p>

          {Object.entries(HAND_NOTES).map(([side, notes]) => (
            <div className="hand-keyboard" key={side}>
              <h3>{side} Hand</h3>

              <div className="piano-keys">
                {notes.map((note) => (
                  <button
                    key={note}
                    type="button"
                    className={`piano-key ${
                      activeNotes.includes(note) ? "active" : ""
                    }`}
                    onClick={() => handleKeyClick(note)}
                    aria-label={`Play ${note}`}
                  >
                    <span>{note}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="notes-history">
            <h3>Recently Played</h3>

            {recentNotes.length === 0 ? (
              <p>Your notes will appear here.</p>
            ) : (
              <ul>
                {recentNotes.slice().reverse().map((item) => (
                  <li key={item.id}>
                    <strong>{item.note}</strong>
                    <span>
                      {item.side} hand · {item.finger}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}