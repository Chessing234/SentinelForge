import { GoogleGenerativeAI } from "@google/generative-ai";

export const MENTOR_SYSTEM_PROMPT = `You are SentinelForge Mentor, an expert cybersecurity instructor. You help students learn by providing guidance without giving direct answers.

Rules:
1. NEVER give the exact answer or flag directly
2. Guide students toward discovery with questions and hints
3. Explain security concepts when asked
4. Reference MITRE ATT&CK techniques when relevant
5. Adapt your help level to the student's demonstrated skill
6. If stuck for >5 minutes, provide stronger hints
7. Celebrate discoveries and explain why they matter
8. Connect current exercise to real-world scenarios

You can discuss: reconnaissance techniques, vulnerability types, exploitation methods, forensic analysis, incident response procedures, security tools.`;

const DEFAULT_MODEL = "gemini-2.5-pro";
const GENERATION_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 2048,
} as const;

const GEMINI_TIMEOUT_MS = 10_000;
export const MENTOR_MAX_MESSAGES_PER_SESSION = 30;

function getClient(): GoogleGenerativeAI | null {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  return new GoogleGenerativeAI(key);
}

function getModel() {
  const client = getClient();
  if (!client) return null;
  const name = process.env.GEMINI_MODEL?.trim() || DEFAULT_MODEL;
  return client.getGenerativeModel({
    model: name,
    generationConfig: GENERATION_CONFIG,
    systemInstruction: MENTOR_SYSTEM_PROMPT,
  });
}

export type MentorChatTurn = { role: "user" | "model"; content: string };

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error("Gemini request timed out")), ms);
    }),
  ]);
}

/**
 * Single-turn Gemini completion using prior turns as context.
 */
export async function chatWithMentor(
  sessionHistory: MentorChatTurn[],
  userMessage: string,
): Promise<string> {
  const model = getModel();
  if (!model) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const contents = [
    ...sessionHistory.map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  const run = model.generateContent({ contents });
  const res = await withTimeout(run, GEMINI_TIMEOUT_MS);
  const text = res.response.text();
  return text.trim() || "I'm here — try rephrasing your question.";
}

export async function* streamChatWithMentor(
  sessionHistory: MentorChatTurn[],
  userMessage: string,
): AsyncGenerator<string, void, undefined> {
  const model = getModel();
  if (!model) {
    throw new Error("GEMINI_API_KEY not configured");
  }

  const contents = [
    ...sessionHistory.map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];

  const streamPromise = model.generateContentStream({ contents });
  const streamResult = await withTimeout(streamPromise, GEMINI_TIMEOUT_MS);

  for await (const chunk of streamResult.stream) {
    let t = "";
    try {
      t = chunk.text();
    } catch {
      continue;
    }
    if (t) yield t;
  }
}

export async function explainTopicWithGemini(topic: string, contextBlock: string): Promise<string> {
  const model = getModel();
  if (!model) {
    throw new Error("GEMINI_API_KEY not configured");
  }
  const prompt = `Explain this cybersecurity topic clearly for a student. Do not reveal flags or exact lab answers.\n\nTopic: ${topic}\n\nSession context (for relevance only):\n${contextBlock.slice(0, 6000)}`;
  const run = model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  const res = await withTimeout(run, GEMINI_TIMEOUT_MS);
  return res.response.text().trim() || "I could not generate an explanation.";
}
