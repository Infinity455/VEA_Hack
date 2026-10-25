import { useCallback, useEffect, useRef, useState } from "react";

import { useHandTracking } from "../piano/HandTracking.js";

import {
  startPianoNote,
  stopPianoNote,
  releaseAllPianoNotes
} from "../piano/Audio.js";

import { HAND_NOTES } from "../piano/Notes.js";
import LoopStation from "../components/LoopStation.jsx";

import "./piano.css";

async function requestGemma(endpoint, payload) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(
      "Could not reach the Gemma API. Start it with npm run dev:api."
    );
  }

  if (!response.ok) {
    throw new Error(result.error ?? "Gemma request failed.");
  }

  return result;
}

export default function Piano() {
  const [activeNotes, setActiveNotes] = useState([]);
  const [recentNotes, setRecentNotes] = useState([]);
  const [error, setError] = useState("");
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiResult, setAiResult] = useState(null);
  const [aiError, setAiError] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [isPlayingSequence, setIsPlayingSequence] = useState(false);

  // Connection to the Loop Station.
  const looperRef = useRef(null);

  // Track which finger or keyboard button is holding each note.
  const noteOwnersRef = useRef(new Map());

  // ==========================================
  // CONTINUOUS NOTE HANDLING
  // ==========================================

  const handleNote = useCallback((note, details = {}) => {
    if (!note) return;

    const action = details.action ?? "start";
    const side = details.side ?? "Keyboard";
    const finger = details.finger ?? "Manual";

    const owner = `${side}:${finger}`;

    // ------------------------------------------
    // START NOTE
    // ------------------------------------------

    if (action === "start") {
      let owners = noteOwnersRef.current.get(note);

      if (!owners) {
        owners = new Set();
        noteOwnersRef.current.set(note, owners);
      }

      // Prevent the same finger from retriggering the note.
      if (owners.has(owner)) return;

      owners.add(owner);

      // The note is already being held by another source.
      if (owners.size > 1) return;

      setError("");

      // Start playing and sustain the note.
      startPianoNote(note).catch((err) => {
        console.error("Audio error:", err);
        setError("Sound failed. Check Audio.js.");
      });

      // Highlight the corresponding piano key.
      setActiveNotes((prev) =>
        prev.includes(note) ? prev : [...prev, note]
      );

      // Add the note to Recently Played.
      setRecentNotes((prev) => [
        {
          id: `${Date.now()}-${Math.random()}`,
          note,
          hand: side,
          finger
        },
        ...prev
      ].slice(0, 8));

      // Record the note's start time if looping.
      looperRef.current?.onNoteEvent(note, "start");
    }

    // ------------------------------------------
    // STOP NOTE
    // ------------------------------------------

    if (action === "stop") {
      const owners = noteOwnersRef.current.get(note);

      if (!owners || !owners.has(owner)) return;

      owners.delete(owner);

      // Don't stop the sound if another source
      // is still holding the same note.
      if (owners.size > 0) return;

      noteOwnersRef.current.delete(note);

      // Stop the sustained note.
      stopPianoNote(note);

      // Remove the piano key highlight.
      setActiveNotes((prev) =>
        prev.filter((n) => n !== note)
      );

      // Record how long the note was held.
      looperRef.current?.onNoteEvent(note, "stop");
    }
  }, []);

  // Release notes if the user leaves the piano page.
  useEffect(() => {
    return () => {
      noteOwnersRef.current.clear();
      releaseAllPianoNotes();
    };
  }, []);

  async function handleGemmaRequest(endpoint, payload) {
    setAiBusy(true);
    setAiError("");
    setAiResult(null);

    try {
      setAiResult(await requestGemma(endpoint, payload));
    } catch (requestError) {
      console.error("Gemma request failed:", requestError);
      setAiError(requestError.message);
    } finally {
      setAiBusy(false);
    }
  }

  async function playGeneratedSequence() {
    if (!aiResult || isPlayingSequence) return;

    setIsPlayingSequence(true);
    try {
      for (const note of aiResult.notes) {
        handleNote(note);
        await new Promise((resolve) => {
          window.setTimeout(resolve, 450);
        });
      }
    } finally {
      setIsPlayingSequence(false);
    }
  }

  // ==========================================
  // HAND TRACKING
  // ==========================================

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

  // ==========================================
  // MANUAL KEYBOARD CONTROLS
  // ==========================================

  const startKey = (note) => {
    handleNote(note, {
      side: "Keyboard",
      finger: "Manual",
      action: "start"
    });
  };

  const stopKey = (note) => {
    handleNote(note, {
      side: "Keyboard",
      finger: "Manual",
      action: "stop"
    });
  };

  // ==========================================
  // PAGE
  // ==========================================

  return (
    <main className="air-piano">

      {/* HEADER */}

      <header className="air-header">
        <div>
          <p className="headline-accent" >KEYLUSION</p>

          <p className="subtitle">
            Turn your hand movements into music with real-time
            computer vision. Curl your fingers to play notes,
            and straighten them to release.
          </p>
        </div>

        <div className="tracking-status">
          <span
            className={`status-dot ${handCount ? "on" : ""}`}
          />

          {handCount === 2
            ? "Two hands detected"
            : handCount === 1
              ? "One hand detected"
              : isTracking
                ? "Looking for hands..."
                : "Camera off"}
        </div>
      </header>

      {/* CAMERA AND VIRTUAL PIANO */}

      <section className="air-grid">

        {/* LIVE CAMERA */}

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
                <p>
                  Start the camera to begin playing.
                </p>
              </div>
            )}

            {isStarting && (
              <div className="camera-message">
                <h3>Starting your camera...</h3>
                <p>
                  Loading the hand-tracking model.
                </p>
              </div>
            )}
          </div>

          <p className="camera-status" role="status">
            {status}
          </p>

          <div className="camera-buttons">
            <button
              type="button"
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
              type="button"
              className="stop-button"
              onClick={stopTracking}
              disabled={!isTracking && !isStarting}
            >
              Stop Camera
            </button>
          </div>

          {error && (
            <p className="error-message">
              {error}
            </p>
          )}
        </article>

        {/* VIRTUAL PIANO */}

        <article className="air-card">
          <div className="section-heading">
            <h2>Virtual Piano</h2>
            <span>Click the tiles or play with your hands</span>
          </div>

          {Object.entries(HAND_NOTES).map(([hand, notes]) => (
            <div className="hand-section" key={hand}>
              <h3>{hand} Hand</h3>

              <div className="piano-keys">
                {notes.map((note) => (
                  <button
                    key={note}
                    type="button"

                    className={`piano-key ${
                      activeNotes.includes(note)
                        ? "active"
                        : ""
                    }`}

                    // Click/touch and HOLD to sustain.
                    onPointerDown={(event) => {
                      event.preventDefault();
                      event.currentTarget.setPointerCapture(
                        event.pointerId
                      );
                      startKey(note);
                    }}

                    // Release to stop.
                    onPointerUp={() => stopKey(note)}
                    onPointerCancel={() => stopKey(note)}
                    onLostPointerCapture={() => stopKey(note)}

                    // Allow keyboard accessibility.
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();

                        if (!event.repeat) {
                          startKey(note);
                        }
                      }
                    }}

                    onKeyUp={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault();
                        stopKey(note);
                      }
                    }}

                    onBlur={() => stopKey(note)}

                    aria-label={`Play ${note}`}
                    aria-pressed={activeNotes.includes(note)}
                  >
                    <span>{note}</span>
                  </button>
                ))}
              </div>
            </div>
          ))}

          {/* RECENTLY PLAYED */}

          <div className="recent-section">
            <h3>Recently Played</h3>

            {recentNotes.length === 0 ? (
              <p>Your notes will appear here.</p>
            ) : (
              <ul>
                {recentNotes.map((item) => (
                  <li key={item.id}>
                    <strong>{item.note}</strong>
                    <span>
                      {item.hand} · {item.finger}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </article>

        <article className="air-card gemma-card">
          <div className="section-heading">
            <h2>Gemma Music Coach</h2>
            <span>Vertex AI</span>
          </div>

          <p className="gemma-description">
            Get a continuation for your recent notes, or describe a melody
            and ask Gemma to make a short sequence you can play.
          </p>

          <button
            className="gemma-button"
            type="button"
            onClick={() => {
              void handleGemmaRequest("/api/gemma/suggest", {
                recentNotes: recentNotes
                  .slice()
                  .reverse()
                  .map((item) => item.note)
              });
            }}
            disabled={aiBusy || isPlayingSequence || recentNotes.length === 0}
          >
            {aiBusy ? "Thinking..." : "Suggest what to play next"}
          </button>
          {recentNotes.length === 0 && (
            <p className="gemma-hint">
              Play a few notes first to get a personalized suggestion.
            </p>
          )}

          <form
            className="gemma-form"
            onSubmit={(event) => {
              event.preventDefault();
              void handleGemmaRequest("/api/gemma/generate", {
                prompt: aiPrompt
              });
            }}
          >
            <label htmlFor="gemma-prompt">Ask for a note sequence</label>
            <textarea
              id="gemma-prompt"
              value={aiPrompt}
              onChange={(event) => setAiPrompt(event.target.value)}
              placeholder="For example: Make a cheerful five-note melody."
              maxLength={500}
              required
              disabled={aiBusy || isPlayingSequence}
            />
            <button
              className="gemma-button"
              type="submit"
              disabled={aiBusy || isPlayingSequence || !aiPrompt.trim()}
            >
              {aiBusy ? "Generating..." : "Generate notes"}
            </button>
          </form>

          {aiError && (
            <p className="gemma-error" role="alert">{aiError}</p>
          )}

          {aiResult && (
            <div className="gemma-result" aria-live="polite">
              <p>{aiResult.message}</p>
              <div className="gemma-notes" aria-label="Generated notes">
                {aiResult.notes.map((note, index) => (
                  <button
                    key={`${note}-${index}`}
                    className="gemma-note"
                    type="button"
                    onClick={() => handleNote(note)}
                    disabled={isPlayingSequence}
                    aria-label={`Play ${note}`}
                  >
                    {note}
                  </button>
                ))}
              </div>
              <button
                className="gemma-button"
                type="button"
                onClick={() => void playGeneratedSequence()}
                disabled={isPlayingSequence}
              >
                {isPlayingSequence ? "Playing sequence..." : "Play sequence"}
              </button>
            </div>
          )}
        </article>
      </section>

      {/* LOOP STATION */}

      <LoopStation ref={looperRef} />

    </main>
  );
}