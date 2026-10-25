
import * as Tone from "tone";

let liveSynth = null;
let loopSynth = null;

// Notes currently being held down.
const heldNotes = new Set();
const noteVersions = new Map();

export async function initializeAudio() {
  await Tone.start();

  if (!liveSynth) {
    liveSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.65,
        release: 0.3
      }
    }).toDestination();
  }

  // Separate instrument for the Loop Station.
  // This prevents loop playback from cutting off live notes.
  if (!loopSynth) {
    loopSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: "triangle" },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.65,
        release: 0.3
      }
    }).toDestination();
  }
}

// Start a note and hold it.
export async function startPianoNote(note) {
  if (heldNotes.has(note)) return;

  heldNotes.add(note);
  const version = (noteVersions.get(note) ?? 0) + 1;
  noteVersions.set(note, version);

  try {
    await initializeAudio();

    if (
      heldNotes.has(note) &&
      noteVersions.get(note) === version
    ) {
      liveSynth.triggerAttack(note);
    }
  } catch (error) {
    heldNotes.delete(note);
    throw error;
  }
}

// Stop the note when its finger is lifted.
export function stopPianoNote(note) {
  heldNotes.delete(note);
  noteVersions.set(
    note,
    (noteVersions.get(note) ?? 0) + 1
  );

  liveSynth?.triggerRelease(note);
}

// Release everything when the piano unmounts.
export function releaseAllPianoNotes() {
  heldNotes.clear();
  noteVersions.clear();
  liveSynth?.releaseAll();
}

// Keep this for any older code that still calls it.
export async function playPianoNote(note) {
  await initializeAudio();
  liveSynth.triggerAttackRelease(note, "8n");
}

// The Loop Station schedules notes at precise times.
export function playLoopNote(note, duration, time) {
  if (!loopSynth) return;

  loopSynth.triggerAttackRelease(
    note,
    Math.max(0.07, duration),
    time
  );
}

export function stopAllLoopNotes() {
  loopSynth?.releaseAll();
}
