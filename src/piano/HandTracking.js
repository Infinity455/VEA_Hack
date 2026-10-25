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

// Curl is measured from both finger-joint bend and tip-to-palm movement.
const CALIBRATION_MS = 650;
const CALIBRATION_ANGLE_TOLERANCE = 18;
const CALIBRATION_DISTANCE_TOLERANCE = 0.12;
const PRESS_BEND_DEGREES = 28;
const RELEASE_BEND_DEGREES = 14;
const PRESS_DISTANCE = 0.18;
const RELEASE_DISTANCE = 0.07;

const SMOOTHING_SECONDS = 0.07;
const MAX_SAMPLE_GAP_MS = 1000;
const DEBOUNCE_MS = 140;

const FINGER_JOINTS = {
  thumb: [2, 3, 4],
  index: [5, 6, 7],
  middle: [9, 10, 11],
  ring: [13, 14, 15],
  pinky: [17, 18, 19]
};

const HAND_CONNECTIONS = [
  [0, 1], [1, 2], [2, 3], [3, 4],
  [0, 5], [5, 6], [6, 7], [7, 8],
  [5, 9], [9, 10], [10, 11], [11, 12],
  [9, 13], [13, 14], [14, 15], [15, 16],
  [13, 17], [17, 18], [18, 19], [19, 20],
  [0, 17]
];

// Calculate the palm center and width.
// Convert horizontal distances into vertical-image units so that
// the video's aspect ratio does not distort the measurement.
function getPalmFrame(landmarks, aspectRatio) {
  const indices = [0, 5, 9, 13, 17];

  const x =
    indices.reduce((sum, i) => sum + landmarks[i].x, 0) /
    indices.length;

  const y =
    indices.reduce((sum, i) => sum + landmarks[i].y, 0) /
    indices.length;

  const width = Math.hypot(
    (landmarks[5].x - landmarks[17].x) * aspectRatio,
    landmarks[5].y - landmarks[17].y
  );

  if (!Number.isFinite(width) || width < 0.02) {
    return null;
  }

  return { x, y, width };
}

function getFingerCurl(landmarks, finger, palm, aspectRatio) {
  const [previousIndex, jointIndex, nextIndex] =
    FINGER_JOINTS[finger.name];
  const previous = landmarks[previousIndex];
  const joint = landmarks[jointIndex];
  const next = landmarks[nextIndex];

  const toPrevious = [
    (previous.x - joint.x) * aspectRatio,
    previous.y - joint.y,
    (previous.z - joint.z) * aspectRatio
  ];
  const toNext = [
    (next.x - joint.x) * aspectRatio,
    next.y - joint.y,
    (next.z - joint.z) * aspectRatio
  ];

  const dot = toPrevious.reduce(
    (sum, value, index) => sum + value * toNext[index],
    0
  );
  const previousLength = Math.hypot(...toPrevious);
  const nextLength = Math.hypot(...toNext);
  if (previousLength < 1e-6 || nextLength < 1e-6) {
    return null;
  }

  const angle = Math.acos(
    Math.max(-1, Math.min(1, dot / (previousLength * nextLength)))
  ) * (180 / Math.PI);

  const tip = landmarks[finger.landmark];
  const distance = Math.hypot(
    (tip.x - palm.x) * aspectRatio,
    tip.y - palm.y
  ) / palm.width;

  return Number.isFinite(angle) && Number.isFinite(distance)
    ? { angle, distance }
    : null;
}

// Update one finger's calibration and press state.
// Returns pressed=true only when the fingertip curls toward the palm.
function updateFinger(state, { angle, distance }, now) {
  if (!state || now - state.time > MAX_SAMPLE_GAP_MS) {
    return {
      state: {
        time: now,
        calibrationStart: now,
        calibrationAnchorAngle: angle,
        calibrationAnchorDistance: distance,
        baselineAngle: angle,
        baselineDistance: distance,
        filteredAngle: angle,
        filteredDistance: distance,
        calibrated: false,
        armed: false,
        lastTrigger: -Infinity
      },
      pressed: false
    };
  }

  const elapsed = Math.max(
    (now - state.time) / 1000,
    0.001
  );

  // Smooth noisy landmark measurements.
  const alpha = 1 - Math.exp(
    -elapsed / SMOOTHING_SECONDS
  );

  const previousFilteredAngle = state.filteredAngle;
  const previousFilteredDistance = state.filteredDistance;

  state.filteredAngle += alpha * (
    angle - state.filteredAngle
  );
  state.filteredDistance += alpha * (
    distance - state.filteredDistance
  );

  state.time = now;

  if (!state.calibrated) {
    const movedDuringCalibration =
      Math.abs(angle - state.calibrationAnchorAngle) >
        CALIBRATION_ANGLE_TOLERANCE ||
      Math.abs(distance - state.calibrationAnchorDistance) >
        CALIBRATION_DISTANCE_TOLERANCE;

    if (movedDuringCalibration) {
      state.calibrationStart = now;
      state.calibrationAnchorAngle = angle;
      state.calibrationAnchorDistance = distance;
      state.baselineAngle = angle;
      state.baselineDistance = distance;
      state.filteredAngle = angle;
      state.filteredDistance = distance;
    } else {
      state.baselineAngle += alpha * (
        angle - state.baselineAngle
      );
      state.baselineDistance += alpha * (
        distance - state.baselineDistance
      );
    }

    if (
      now - state.calibrationStart >= CALIBRATION_MS
    ) {
      state.calibrated = true;
      state.armed = true;
    }

    return { state, pressed: false };
  }

  const bend = state.baselineAngle - state.filteredAngle;
  const previousBend =
    state.baselineAngle - previousFilteredAngle;
  const distanceChange =
    state.baselineDistance - state.filteredDistance;
  const previousDistanceChange =
    state.baselineDistance - previousFilteredDistance;

  // Extend close to the calibrated position before another press.
  if (
    bend <= RELEASE_BEND_DEGREES &&
    distanceChange <= RELEASE_DISTANCE
  ) {
    state.armed = true;
  }

  const crossedPress =
    (previousBend < PRESS_BEND_DEGREES &&
      bend >= PRESS_BEND_DEGREES) ||
    (previousDistanceChange < PRESS_DISTANCE &&
      distanceChange >= PRESS_DISTANCE);

  const pressed =
    state.armed &&
    crossedPress &&
    now - state.lastTrigger >= DEBOUNCE_MS;

  // A curl crossing consumes the gesture; extend to trigger again.
  if (crossedPress) {
    state.armed = false;
  }

  if (pressed) {
    state.lastTrigger = now;
  }

  return { state, pressed };
}

export function useHandTracking(onNoteDetected) {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  const landmarkerRef = useRef(null);
  const streamRef = useRef(null);
  const frameRef = useRef(null);
  const runningRef = useRef(false);

  // Invalidates unfinished work when tracking stops or restarts.
  const sessionRef = useRef(0);

  const previousPositionsRef = useRef(new Map());
  const activeUntilRef = useRef(new Map());
  const onNoteRef = useRef(onNoteDetected);

  const [status, setStatus] = useState(
    "Camera is off."
  );
  const [isStarting, setIsStarting] = useState(false);
  const [isTracking, setIsTracking] = useState(false);
  const [handCount, setHandCount] = useState(0);

  useEffect(() => {
    onNoteRef.current = onNoteDetected;
  }, [onNoteDetected]);

  const stopTracking = useCallback(() => {
    runningRef.current = false;
    sessionRef.current += 1;

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
      context.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
      );
    }

    setIsStarting(false);
    setIsTracking(false);
    setHandCount(0);
    setStatus("Camera is off.");
  }, []);

  const startTracking = useCallback(async () => {
    if (runningRef.current) return;

    const session = ++sessionRef.current;

    const isCurrent = () =>
      runningRef.current &&
      sessionRef.current === session;

    runningRef.current = true;
    previousPositionsRef.current.clear();
    activeUntilRef.current.clear();

    setIsStarting(true);
    setStatus(
      "Starting camera and loading hand tracker..."
    );

    try {
      // Call startTracking from a user action, such as a click.
      await initializeAudio();

      if (!isCurrent()) return;

      const stream =
        await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: "user",
            width: { ideal: 640 },
            height: { ideal: 480 }
          },
          audio: false
        });

      if (!isCurrent()) {
        stream.getTracks().forEach((track) => {
          track.stop();
        });
        return;
      }

      streamRef.current = stream;

      const video = videoRef.current;

      if (!video) {
        throw new Error(
          "Camera video element was not found."
        );
      }

      video.srcObject = stream;
      await video.play();

      if (!isCurrent()) return;

      const vision =
        await FilesetResolver.forVisionTasks(WASM_URL);

      if (!isCurrent()) return;

      const detector =
        await HandLandmarker.createFromOptions(
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

      if (!isCurrent()) {
        detector.close();
        return;
      }

      landmarkerRef.current = detector;

      setIsStarting(false);
      setIsTracking(true);
      setStatus(
        "Hold fingers extended and steady to calibrate."
      );

      let lastVideoTime = -1;

      const renderFrame = () => {
        try {
          if (!isCurrent()) return;

          const currentVideo = videoRef.current;
          const canvas = canvasRef.current;
          const landmarker = landmarkerRef.current;

          if (
            currentVideo &&
            canvas &&
            landmarker &&
            currentVideo.readyState >= 2 &&
            currentVideo.currentTime !== lastVideoTime
          ) {
            const width = currentVideo.videoWidth;
            const height = currentVideo.videoHeight;
            const now = performance.now();

            if (width > 0 && height > 0) {
              if (canvas.width !== width) {
                canvas.width = width;
              }

              if (canvas.height !== height) {
                canvas.height = height;
              }

              lastVideoTime = currentVideo.currentTime;

              const ctx = canvas.getContext("2d");

              if (ctx) {
                ctx.clearRect(0, 0, width, height);
              }

              const result = landmarker.detectForVideo(
                currentVideo,
                now
              );

              const hands = result.landmarks ?? [];
              const seenFingers = new Set();

              let allCalibrated = hands.length > 0;

              setHandCount(hands.length);

              hands.forEach((landmarks, handIndex) => {
                // Preserve your original left/right note mapping.
                const rawSide =
                  result.handednesses?.[handIndex]?.[0]
                    ?.categoryName;

                const side =
                  rawSide === "Left"
                    ? "Right"
                    : rawSide === "Right"
                      ? "Left"
                      : handIndex === 0
                        ? "Left"
                        : "Right";

                const palm = getPalmFrame(
                  landmarks,
                  width / height
                );

                if (!palm) {
                  allCalibrated = false;
                  return;
                }

                if (ctx) {
                  // Yellow ring marks the palm reference.
                  ctx.beginPath();
                  ctx.strokeStyle = "#2563eb";
                  ctx.lineWidth = 2;
                  ctx.arc(
                    (1 - palm.x) * width,
                    palm.y * height,
                    8,
                    0,
                    Math.PI * 2
                  );
                  ctx.stroke();

                  // Draw the hand skeleton.
                  ctx.strokeStyle =  "#d946ef";
                  ctx.lineWidth = 2;

                  HAND_CONNECTIONS.forEach(([a, b]) => {
                    const pointA = landmarks[a];
                    const pointB = landmarks[b];

                    ctx.beginPath();
                    ctx.moveTo(
                      (1 - pointA.x) * width,
                      pointA.y * height
                    );
                    ctx.lineTo(
                      (1 - pointB.x) * width,
                      pointB.y * height
                    );
                    ctx.stroke();
                  });

                  landmarks.forEach((point) => {
                    ctx.beginPath();
                    ctx.fillStyle = "#d946ef";
                    ctx.arc(
                      (1 - point.x) * width,
                      point.y * height,
                      3,
                      0,
                      Math.PI * 2
                    );
                    ctx.fill();
                  });
                }

                FINGERS.forEach((finger, fingerIndex) => {
                  const point =
                    landmarks[finger.landmark];

                  const key = `${side}:${finger.name}`;

                  const note = getNoteForFinger(
                    side,
                    fingerIndex
                  );

                  seenFingers.add(key);

                  // Normalize tip-to-palm distance so hand size and
                  // movement toward or away from the camera do not
                  // change the curl threshold.
                  const curl = getFingerCurl(
                    landmarks,
                    finger,
                    palm,
                    width / height
                  );
                  if (!curl) {
                    allCalibrated = false;
                    previousPositionsRef.current.delete(key);
                    return;
                  }

                  const { state, pressed } = updateFinger(
                    previousPositionsRef.current.get(key),
                    curl,
                    now
                  );

                  previousPositionsRef.current.set(
                    key,
                    state
                  );

                  if (!state.calibrated) {
                    allCalibrated = false;
                  }

                  if (pressed) {
                    onNoteRef.current?.(note, {
                      side,
                      finger: finger.label
                    });

                    activeUntilRef.current.set(
                      key,
                      now + 200
                    );
                  }

                  if (!ctx) return;

                  const x = (1 - point.x) * width;
                  const y = point.y * height;

                  const isActive =
                    (activeUntilRef.current.get(key) ?? 0)
                    > now;

                  // Yellow: calibrating.
                  // Red: ready. Green: note triggered.
                  ctx.beginPath();
                  ctx.fillStyle = !state.calibrated
                    ? "#2563EB"
                    : isActive
                      ? "#d946ef"
                      : "#00e5ff";

                  ctx.arc(
                    x,
                    y,
                    7,
                    0,
                    Math.PI * 2
                  );
                  ctx.fill();

                  ctx.fillStyle = "#ffffff";
                  ctx.font = "bold 13px sans-serif";
                  ctx.fillText(note, x + 9, y - 9);
                });
              });

              setStatus(
                hands.length === 0
                  ? "Show your hands with fingers extended to calibrate."
                  : allCalibrated
                    ? "Ready. Curl a finger toward your palm; extend it to play again."
                    : "Calibrating: hold fingers extended and steady briefly."
              );

              // Keep calibration through brief landmark dropouts.
              for (
                const key of
                previousPositionsRef.current.keys()
              ) {
                const state =
                  previousPositionsRef.current.get(key);

                if (
                  !seenFingers.has(key) &&
                  now - state.time > MAX_SAMPLE_GAP_MS
                ) {
                  previousPositionsRef.current.delete(key);
                  activeUntilRef.current.delete(key);
                }
              }
            }
          }

          frameRef.current =
            window.requestAnimationFrame(renderFrame);
        } catch (error) {
          if (!isCurrent()) return;

          stopTracking();

          console.error(
            "Hand tracking failed:",
            error
          );

          setStatus(
            error instanceof Error
              ? error.message
              : "Hand tracking failed."
          );
        }
      };

      renderFrame();
    } catch (error) {
      if (!isCurrent()) return;

      stopTracking();

      console.error(
        "Hand tracking failed:",
        error
      );

      setStatus(
        error instanceof Error
          ? error.message
          : "Could not start hand tracking."
      );
    }
  }, [stopTracking]);

  useEffect(() => {
    return () => {
      runningRef.current = false;
      sessionRef.current += 1;

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