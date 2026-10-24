export const FINGERS = [
  { name: "thumb", label: "Thumb", landmark: 4 },
  { name: "index", label: "Index", landmark: 8 },
  { name: "middle", label: "Middle", landmark: 12 },
  { name: "ring", label: "Ring", landmark: 16 },
  { name: "pinky", label: "Pinky", landmark: 20 }
];

export const HAND_NOTES = {
  Left: ["C4", "D4", "E4", "F4", "G4"],
  Right: ["A4", "B4", "C5", "D5", "E5"]
};

export function getNoteForFinger(side, fingerIndex) {
  return HAND_NOTES[side]?.[fingerIndex] ?? null;
}