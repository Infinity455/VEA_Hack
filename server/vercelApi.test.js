import assert from "node:assert/strict";
import test from "node:test";
import handler from "../api/gemma/[action].js";

function createResponse() {
  return {
    headers: {},
    statusCode: 200,
    body: undefined,
    setHeader(name, value) {
      this.headers[name] = value;
    },
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    }
  };
}

test("Vercel Gemma route rejects methods other than POST", async () => {
  const response = createResponse();
  await handler({ method: "GET" }, response);
  assert.equal(response.statusCode, 405);
  assert.equal(response.headers.Allow, "POST");
});

test("Vercel Gemma route validates suggestion input", async () => {
  const response = createResponse();
  await handler({
    method: "POST",
    query: { action: "suggest" },
    body: { recentNotes: [] }
  }, response);
  assert.equal(response.statusCode, 400);
  assert.equal(response.body.error, "Provide up to 40 recently played notes.");
});

test("Vercel Gemma route returns 404 for unknown actions", async () => {
  const response = createResponse();
  await handler({
    method: "POST",
    query: { action: "unknown" },
    body: {}
  }, response);
  assert.equal(response.statusCode, 404);
});
