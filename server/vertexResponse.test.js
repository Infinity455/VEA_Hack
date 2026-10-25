import assert from "node:assert/strict";
import test from "node:test";
import { describeResponseShape, extractGeneratedText } from "./vertexResponse.js";

test("extracts text from chat-completions prediction responses", () => {
  assert.equal(
    extractGeneratedText({
      predictions: [{ choices: [{ message: { content: "  hello  " } }] }]
    }),
    "hello"
  );
});

test("extracts text from Vertex chat-completions object wrapper", () => {
  assert.equal(
    extractGeneratedText({
      deployedModelId: "model",
      predictions: { choices: [{ message: { content: "hello from Gemma" } }] }
    }),
    "hello from Gemma"
  );
});

test("extracts text from candidate content parts", () => {
  assert.equal(
    extractGeneratedText({
      predictions: [{
        candidates: [{ content: { parts: [{ text: "hello " }, { text: "world" }] } }]
      }]
    }),
    "hello world"
  );
});

test("extracts text from generated-text prediction responses", () => {
  assert.equal(
    extractGeneratedText({ predictions: [{ generated_text: "hello" }] }),
    "hello"
  );
});

test("returns no text for responses without generated content", () => {
  const response = { predictions: [{ safetyAttributes: {} }] };
  assert.equal(extractGeneratedText(response), undefined);
  assert.deepEqual(describeResponseShape(response), {
    topLevel: ["predictions"],
    predictionsType: "array",
    firstPrediction: ["safetyAttributes"],
    firstChoice: [],
    firstCandidate: []
  });
});
