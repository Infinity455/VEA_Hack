import dotenv from "dotenv";
import express from "express";
import { GoogleAuth } from "google-auth-library";
import { describeResponseShape, extractGeneratedText } from "./vertexResponse.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
const project = process.env.GOOGLE_CLOUD_PROJECT;
const location = process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1";
const endpointId = process.env.VERTEX_ENDPOINT_ID;
const endpointHost =
  process.env.VERTEX_ENDPOINT_HOST ?? `${location}-aiplatform.googleapis.com`;
const auth = new GoogleAuth({
  scopes: ["https://www.googleapis.com/auth/cloud-platform"]
});
const allowedNotes = new Set([
  "C4", "D4", "E4", "F4", "G4",
  "A4", "B4", "C5", "D5", "E5"
]);
app.use(express.json({ limit: "10kb" }));

function validateNoteSequence(notes) {
  return (
    Array.isArray(notes) &&
    notes.length >= 3 &&
    notes.length <= 8 &&
    notes.every((note) => allowedNotes.has(note))
  );
}

async function generateMusicResponse(instructions) {
  if (!project || !endpointId) {
    const error = new Error(
      "Set GOOGLE_CLOUD_PROJECT and VERTEX_ENDPOINT_ID in .env.local before using Gemma."
    );
    error.status = 503;
    throw error;
  }

  const prompt = [
    "You are a helpful piano improvisation coach. The playable notes are " +
      [...allowedNotes].join(", ") +
      ". Return only a JSON object with exactly two fields: " +
      '"message" (a brief encouraging explanation) and "notes" ' +
      "(an array of 3 to 8 playable note names). Do not include markdown.",
    instructions
  ].join("\n\n");
  const endpoint = `https://${endpointHost}/v1/projects/${encodeURIComponent(project)}/locations/${encodeURIComponent(location)}/endpoints/${encodeURIComponent(endpointId)}:predict`;
  const authClient = await auth.getClient();
  const { data } = await authClient.request({
    url: endpoint,
    method: "POST",
    data: {
      instances: [{
        "@requestFormat": "chatCompletions",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.7
      }]
    }
  });

  const generatedText = extractGeneratedText(data);

  if (typeof generatedText !== "string" || !generatedText.trim()) {
    const error = new Error(
      `Gemma returned no text in a supported response field. Vertex response shape: ${JSON.stringify(describeResponseShape(data))}`
    );
    error.status = 502;
    throw error;
  }

  let result;
  try {
    const text = generatedText
      .trim()
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/, "");
    result = JSON.parse(text);
  } catch {
    const error = new Error(
      "Gemma returned an invalid response. Please try again."
    );
    error.status = 502;
    throw error;
  }

  if (
    !result ||
    typeof result.message !== "string" ||
    !validateNoteSequence(result.notes)
  ) {
    const error = new Error(
      "Gemma did not return a valid note sequence. Please try again."
    );
    error.status = 502;
    throw error;
  }

  return {
    message: result.message.slice(0, 500),
    notes: result.notes
  };
}

async function sendGemmaResponse(response, instructions, label) {
  try {
    return response.json(
      await generateMusicResponse(instructions)
    );
  } catch (error) {
    console.error(`${label} failed:`, error);
    return response.status(error.status ?? 502).json({
      error: error.status
        ? error.message
        : "Gemma could not respond. Check your Vertex AI setup, model access, and network connection."
    });
  }
}

app.post("/api/gemma/suggest", async (request, response) => {
  const { recentNotes } = request.body ?? {};
  if (
    !Array.isArray(recentNotes) ||
    recentNotes.length === 0 ||
    recentNotes.length > 40 ||
    !recentNotes.every((note) => allowedNotes.has(note))
  ) {
    return response.status(400).json({
      error: "Provide up to 40 recently played notes."
    });
  }

  return sendGemmaResponse(
    response,
    `Suggest the next 3 to 5 notes based on this recent piano phrase: ` +
      `${recentNotes.join(", ")}. Keep the melody musical and easy to play.`,
    "Gemma suggestion"
  );
});

app.post("/api/gemma/generate", async (request, response) => {
  const prompt =
    typeof request.body?.prompt === "string"
      ? request.body.prompt.trim()
      : "";

  if (!prompt || prompt.length > 500) {
    return response.status(400).json({
      error: "Enter a request of 1 to 500 characters."
    });
  }

  return sendGemmaResponse(
    response,
    `Create a playable piano note sequence for this request: ${prompt}`,
    "Gemma sequence generation"
  );
});

app.listen(port, "127.0.0.1", () => {
  console.log(
    `Gemma API listening on http://127.0.0.1:${port}; Vertex endpoint host: ${endpointHost}`
  );
});
