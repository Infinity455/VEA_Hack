
import { useCallback, useState } from "react";
import { useHandTracking } from "../piano/HandTracking.js";
import { playPianoNote } from "../piano/Audio.js";
import { HAND_NOTES } from "../piano/Notes.js";
import "./piano.css";

export default function Piano() {
  const [activeNotes, setActiveNotes] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [error, setError] = useState("");

  const handleNote = useCallback((note, details = {}) => {
    playPianoNote(note).catch((err) => {
      console.error("Audio error:", err);
      setError("Sound failed. Check Audio.js.");
    });

    setActiveNotes((prev) =>
      prev.includes(note) ? prev : [...prev, note]
    );

    setRecentNotes((prev) => [
      {
        id: `${Date.now()}-${Math.random()}`,
        note,
        hand: details.side ?? "Keyboard",
        finger: details.finger ?? "Manual"
      },
      ...prev
    ].slice(0, 8));

    window.setTimeout(() => {
      setActiveNotes((prev) =>
        prev.filter((n) => n !== note)
      );
    }, 250);
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

  return (
    <main className="air-piano">
      <header className="air-header">
        <div>
          <p className="eyebrow">KEYLUSION</p>
          <h1>Play music with your hands.</h1>
          <p className="subtitle">
            Your hands are the instrument. Curl a finger toward
            your palm to play its note, then extend it to play again.
          </p>
        </div>

        <div className="tracking-status">
          <span className={`status-dot ${handCount ? "on" : ""}`} />
          {handCount === 2
            ? "Two hands detected"
            : handCount === 1
              ? "One hand detected"
              : isTracking
                ? "Looking for hands..."
                : "Camera off"}
        </div>
      </header>

      <section className="air-grid">
        <article className="air-card">
          <div className="section-heading">
            <h2>Live Camera</h2>
            <span>MediaPipe tracking</span>
          </div>

          <div className="camera-box">
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
            />

            <canvas ref={canvasRef} />

            {!isTracking && !isStarting && (
              <div className="camera-message">
                <span className="camera-icon">📷</span>
                <h3>See yourself here</h3>
                <p>Start the camera to begin playing.</p>
              </div>
            )}

            {isStarting && (
              <div className="camera-message">
                <h3>Starting your camera...</h3>
                <p>Loading the hand-tracking model.</p>
              </div>
            )}
          </div>

          <p className="camera-status" role="status">
            {status}
          </p>

          <div className="camera-buttons">
            <button
              className="start-button"
              onClick={() => {
                setError("");
                startTracking();
              }}
              disabled={isTracking || isStarting}
            >
              {isStarting ? "Starting..." : "Start Camera"}
            </button>

            <button
              className="stop-button"
              onClick={stopTracking}
              disabled={!isTracking && !isStarting}
            >
              Stop Camera
            </button>
          </div>

          {error && <p className="error-message">{error}</p>}
        </article>

        <article className="air-card">
          <div className="section-heading">
            <h2>Virtual Piano</h2>
            <span>Click or play with your hands</span>
          </div>

          {Object.entries(HAND_NOTES).map(([hand, notes]) => (
            <div className="hand-section" key={hand}>
              <h3>{hand} Hand</h3>

              <div className="piano-keys">
                {notes.map((note) => (
                  <button
                    key={note}
                    className={`piano-key ${
                      activeNotes.includes(note) ? "active" : ""
                    }`}
                    onClick={() => handleNote(note)}
                    aria-label={`Play ${note}`}
                  >
                    <span>{note}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div className="recent-section">
            <h3>Recently Played</h3>

            {recentNotes.length === 0 ? (
              <p>Your notes will appear here.</p>
            ) : (
              <ul>
                {recentNotes.map((item) => (
                  <li key={item.id}>
                    <strong>{item.note}</strong>
                    <span>{item.hand} · {item.finger}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>
      </section>
    </main>
  );
}
