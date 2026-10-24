import * as Tone from "tone";

let synth = null;

export async function initializeAudio() {
  await Tone.start();

  if (!synth) {
    synth = new Tone.PolySynth(Tone.Synth, {
      oscillator: {
        type: "triangle"
      },
      envelope: {
        attack: 0.01,
        decay: 0.15,
        sustain: 0.25,
        release: 0.7
      }
    }).toDestination();
  }
}

export async function playPianoNote(note) {
  if (!synth) {
    await initializeAudio();
  }

  synth.triggerAttackRelease(note, "8n");
}