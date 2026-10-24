import {
  useCallback,
  useEffect,
  useRef,
  useState
} from "react";

import {
  FilesetResolver,
  HandLandmarker
} from "@mediapipe/tasks-vision";

import { initializeAudio } from "./Audio.js";
import { FINGERS, getNoteForFinger } from "./Notes.js";

const WASM_URL =
  "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@latest/wasm";

const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

// Normalized vertical position of the virtual keyboard line.
const KEY_LINE_Y = 0.72;
const RESET_MARGIN = 0.08;

// Downward finger speed, measured in normalized image units per second.
const MIN_DOWNWARD_SPEED = 0.35;
const DEBOUNCE_MS = 140;

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

export function useHandTracking(onNoteDetected) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const runningRef = useRef(false);

  const previousPositionsRef = useRef(new Map());
  const activeUntilRef = useRef(new Map());
  const onNoteRef = useRef(onNoteDetected);

  const [status, setStatus] = useState("Camera is off.");
  const [isStarting, setIsStarting] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [handCount, setHandCount] = useState(0);

  useEffect(() => {
    onNoteRef.current = onNoteDetected;
  }, [onNoteDetected]);

  const stopTracking = useCallback(() => {
    runningRef.current = false;

    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }

    frameRef.current = null;

    streamRef.current?.getTracks().forEach((track) => {
      track.stop();
    });

    streamRef.current = null;

    if (videoRef.current) {
      videoRef.current.pause();
      videoRef.current.srcObject = null;
    }

    landmarkerRef.current?.close();
    landmarkerRef.current = null;

    previousPositionsRef.current.clear();
    activeUntilRef.current.clear();

    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");

    if (canvas && context) {
      context.clearRect(0, 0, canvas.width, canvas.height);
    }

    setIsStarting(false);
    setIsTracking(false);
    setHandCount(0);
    setStatus("Camera is off.");
  }, []);

  const startTracking = useCallback(async () => {
    if (runningRef.current) return;

    runningRef.current = true;
    setIsStarting(true);
    setStatus("Starting camera and loading hand tracker...");

    try {
      // Audio must be initialized from a user interaction.
      await initializeAudio();

      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 }
        },
        audio: false
      });

      if (!runningRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error("Camera video element was not found.");
      }

      video.srcObject = stream;
      await video.play();

      const vision = await FilesetResolver.forVisionTasks(WASM_URL);

      if (!runningRef.current) return;

      const detector = await HandLandmarker.createFromOptions(
        vision,
        {
          baseOptions: {
            modelAssetPath: MODEL_URL
          },
          runningMode: "VIDEO",
          numHands: 2,
          minHandDetectionConfidence: 0.5,
          minHandPresenceConfidence: 0.5,
          minTrackingConfidence: 0.5
        }
      );

      if (!runningRef.current) {
        detector.close();
        return;
      }

      landmarkerRef.current = detector;

      setIsStarting(false);
      setIsTracking(true);
      setStatus(
        "Ready. Move your fingers downward across the yellow line."
      );

      const renderFrame = () => {
        if (!runningRef.current) return;

        const currentVideo = videoRef.current;
        const canvas = canvasRef.current;
        const landmarker = landmarkerRef.current;

        if (
          currentVideo &&
          canvas &&
          landmarker &&
          currentVideo.readyState >= 2
        ) {
          const width = currentVideo.videoWidth;
          const height = currentVideo.videoHeight;
          const now = performance.now();

          if (width > 0 && height > 0) {
            if (canvas.width !== width) canvas.width = width;
            if (canvas.height !== height) canvas.height = height;

            const ctx = canvas.getContext("2d");

            if (ctx) {
              ctx.clearRect(0, 0, width, height);

              // Draw the virtual keyboard line.
              ctx.beginPath();
              ctx.setLineDash([8, 6]);
              ctx.strokeStyle = "#fbbf24";
              ctx.lineWidth = 3;
              ctx.moveTo(0, KEY_LINE_Y * height);
              ctx.lineTo(width, KEY_LINE_Y * height);
              ctx.stroke();
              ctx.setLineDash([]);

              ctx.fillStyle = "#fbbf24";
              ctx.font = "bold 14px sans-serif";
              ctx.fillText(
                "VIRTUAL KEYBOARD LINE",
                12,
                KEY_LINE_Y * height - 10
              );
            }

            const result = landmarker.detectForVideo(
              currentVideo,
              now
            );

            const hands = result.landmarks ?? [];
            const seenFingers = new Set();

            setHandCount(hands.length);

            hands.forEach((landmarks, handIndex) => {
              // The camera image is unmirrored during detection,
              // so swap MediaPipe's handedness labels.
              const rawSide =
                result.handednesses?.[handIndex]?.[0]?.categoryName;

              const side =
                rawSide === "Left"
                  ? "Right"
                  : rawSide === "Right"
                    ? "Left"
                    : handIndex === 0
                      ? "Left"
                      : "Right";

              if (!ctx) return;

              // Draw hand connections.
              ctx.strokeStyle = "#34d399";
              ctx.lineWidth = 2;

              HAND_CONNECTIONS.forEach(([a, b]) => {
                const pointA = landmarks[a];
                const pointB = landmarks[b];

                ctx.beginPath();
                ctx.moveTo((1 - pointA.x) * width, pointA.y * height);
                ctx.lineTo((1 - pointB.x) * width, pointB.y * height);
                ctx.stroke();
              });

              // Draw all 21 landmarks.
              landmarks.forEach((point) => {
                ctx.beginPath();
                ctx.fillStyle = "#34d399";
                ctx.arc(
                  (1 - point.x) * width,
                  point.y * height,
                  3,
                  0,
                  Math.PI * 2
                );
                ctx.fill();
              });

              // Process each of the five fingertips.
              FINGERS.forEach((finger, fingerIndex) => {
                const point = landmarks[finger.landmark];
                const key = `${side}:${finger.name}`;
                const note = getNoteForFinger(side, fingerIndex);

                seenFingers.add(key);

                let previous = previousPositionsRef.current.get(key);

                if (!previous) {
                  previous = {
                    y: point.y,
                    time: now,
                    armed: point.y < KEY_LINE_Y - RESET_MARGIN,
                    lastTrigger: -Infinity
                  };

                  previousPositionsRef.current.set(key, previous);
                } else {
                  const elapsed = Math.max(
                    (now - previous.time) / 1000,
                    1 / 120
                  );

                  const downwardSpeed =
                    (point.y - previous.y) / elapsed;

                  const crossedLine =
                    previous.y < KEY_LINE_Y &&
                    point.y >= KEY_LINE_Y;

                  // Re-arm the finger after it lifts.
                  if (point.y < KEY_LINE_Y - RESET_MARGIN) {
                    previous.armed = true;
                  }

                  if (
                    previous.armed &&
                    crossedLine &&
                    downwardSpeed >= MIN_DOWNWARD_SPEED &&
                    now - previous.lastTrigger >= DEBOUNCE_MS
                  ) {
                    onNoteRef.current?.(note, {
                      side,
                      finger: finger.label
                    });

                    previous.armed = false;
                    previous.lastTrigger = now;

                    activeUntilRef.current.set(key, now + 200);
                  }

                  previous.y = point.y;
                  previous.time = now;
                }

                const x = (1 - point.x) * width;
                const y = point.y * height;

                const isActive =
                  (activeUntilRef.current.get(key) ?? 0) > now;

                // Highlight the fingertip when its note triggers.
                ctx.beginPath();
                ctx.fillStyle = isActive ? "#34d399" : "#f87171";
                ctx.arc(x, y, 7, 0, Math.PI * 2);
                ctx.fill();

                ctx.fillStyle = "#ffffff";
                ctx.font = "bold 13px sans-serif";
                ctx.fillText(note, x + 9, y - 9);
              });
            });

            // Remove stale positions when a finger is no longer visible.
            for (const key of previousPositionsRef.current.keys()) {
              if (!seenFingers.has(key)) {
                previousPositionsRef.current.delete(key);
              }
            }
          }
        }

        frameRef.current =
          window.requestAnimationFrame(renderFrame);
      };

      renderFrame();
    } catch (error) {
      console.error("Hand tracking failed:", error);

      runningRef.current = false;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      streamRef.current = null;

      landmarkerRef.current?.close();
      landmarkerRef.current = null;

      if (videoRef.current) {
        videoRef.current.srcObject = null;
      }

      setIsStarting(false);
      setIsTracking(false);
      setHandCount(0);

      setStatus(
        error instanceof Error
          ? error.message
          : "Could not start hand tracking."
      );
    }
  }, []);

  useEffect(() => {
    return () => {
      runningRef.current = false;

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      streamRef.current?.getTracks().forEach((track) => {
        track.stop();
      });

      landmarkerRef.current?.close();
    };
  }, []);

  return {
    videoRef,
    canvasRef,
    status,
    isStarting,
    isTracking,
    handCount,
    startTracking,
    stopTracking
  };
}