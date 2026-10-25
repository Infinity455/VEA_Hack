import dotenv from "dotenv";
import express from "express";
import { handleGemmaRequest } from "./gemma.js";

dotenv.config({ path: ".env.local" });
dotenv.config();

const app = express();
const port = Number(process.env.API_PORT ?? 3001);
app.use(express.json({ limit: "10kb" }));

app.post("/api/gemma/suggest", async (request, response) => {
  return handleGemmaRequest("suggest", request.body, response);
});

app.post("/api/gemma/generate", async (request, response) => {
  return handleGemmaRequest("generate", request.body, response);
});

app.listen(port, "127.0.0.1", () => {
  console.log(
    `Gemma API listening on http://127.0.0.1:${port}; Vertex endpoint host: ${process.env.VERTEX_ENDPOINT_HOST ?? `${process.env.GOOGLE_CLOUD_LOCATION ?? "us-central1"}-aiplatform.googleapis.com`}`
  );
});
