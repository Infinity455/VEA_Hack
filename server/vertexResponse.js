function textFromContent(content) {
  if (typeof content === "string") {
    return content.trim() || undefined;
  }

  if (!content || typeof content !== "object") {
    return undefined;
  }

  if (typeof content.text === "string" && content.text.trim()) {
    return content.text.trim();
  }

  if (Array.isArray(content.parts)) {
    const text = content.parts
      .map((part) => (typeof part?.text === "string" ? part.text : ""))
      .join("")
      .trim();
    return text || undefined;
  }

  return undefined;
}

export function extractGeneratedText(data) {
  const predictionContainer = data?.predictions;
  const prediction = Array.isArray(predictionContainer)
    ? predictionContainer[0]
    : predictionContainer;
  const choice = prediction?.choices?.[0];
  const candidate = prediction?.candidates?.[0] ?? data?.candidates?.[0];
  const responseChoice = data?.choices?.[0];
  const possibleOutputs = [
    choice?.message?.content,
    choice?.text,
    prediction?.generated_text,
    prediction?.output,
    prediction?.text,
    prediction?.content,
    candidate?.content,
    candidate?.text,
    responseChoice?.message?.content,
    responseChoice?.text,
    data?.generated_text,
    data?.output,
    data?.text
  ];

  for (const output of possibleOutputs) {
    const text = textFromContent(output);
    if (text) {
      return text;
    }
  }

  return undefined;
}

export function describeResponseShape(data) {
  const predictionContainer = data?.predictions;
  const prediction = Array.isArray(predictionContainer)
    ? predictionContainer[0]
    : predictionContainer;
  const choice = prediction?.choices?.[0];
  const candidate = prediction?.candidates?.[0] ?? data?.candidates?.[0];

  const keys = (value) =>
    value && typeof value === "object" && !Array.isArray(value)
      ? Object.keys(value)
      : [];

  return {
    topLevel: keys(data),
    predictionsType: Array.isArray(predictionContainer)
      ? "array"
      : typeof predictionContainer,
    firstPrediction: keys(prediction),
    firstChoice: keys(choice),
    firstCandidate: keys(candidate)
  };
}
