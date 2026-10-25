import { handleGemmaRequest } from "../../server/gemma.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    response.setHeader("Allow", "POST");
    return response.status(405).json({ error: "Method not allowed." });
  }

  const action = Array.isArray(request.query.action)
    ? request.query.action[0]
    : request.query.action;

  return handleGemmaRequest(action, request.body, response);
}
