import { GoogleGenerativeAI } from "@google/generative-ai";
import OpenAI from "openai";

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

export type MentorProvider = "openai" | "gemini";

export type MentorChatTurn = { role: "user" | "model"; content: string };

export const MENTOR_MAX_MESSAGES_PER_SESSION = 30;

const LLM_TIMEOUT_MS = 10_000;
const DEFAULT_OPENAI_MODEL = "gpt-4o-mini";
const DEFAULT_GEMINI_MODEL = "gemini-2.5-pro";

const GENERATION_CONFIG = {
  temperature: 0.3,
  maxOutputTokens: 2048,
} as const;

export function getMentorProvider(): MentorProvider | null {
  if (process.env.OPENAI_API_KEY?.trim()) return "openai";
  if (process.env.GEMINI_API_KEY?.trim()) return "gemini";
  return null;
}

export function isMentorLlmConfigured(): boolean {
  return getMentorProvider() !== null;
}

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => {
      setTimeout(() => reject(new Error(`${label} request timed out`)), ms);
    }),
  ]);
}

function getGeminiModel() {
  const key = process.env.GEMINI_API_KEY?.trim();
  if (!key) return null;
  const client = new GoogleGenerativeAI(key);
  const name = process.env.GEMINI_MODEL?.trim() || DEFAULT_GEMINI_MODEL;
  return client.getGenerativeModel({
    model: name,
    generationConfig: GENERATION_CONFIG,
    systemInstruction: MENTOR_SYSTEM_PROMPT,
  });
}

function getOpenAIClient(): OpenAI | null {
  const key = process.env.OPENAI_API_KEY?.trim();
  if (!key) return null;
  return new OpenAI({ apiKey: key });
}

function openAIMessages(sessionHistory: MentorChatTurn[], userMessage: string): OpenAI.Chat.ChatCompletionMessageParam[] {
  return [
    { role: "system", content: MENTOR_SYSTEM_PROMPT },
    ...sessionHistory.map((h) => ({
      role: (h.role === "model" ? "assistant" : "user") as "assistant" | "user",
      content: h.content,
    })),
    { role: "user", content: userMessage },
  ];
}

function geminiContents(sessionHistory: MentorChatTurn[], userMessage: string) {
  return [
    ...sessionHistory.map((h) => ({
      role: h.role,
      parts: [{ text: h.content }],
    })),
    { role: "user" as const, parts: [{ text: userMessage }] },
  ];
}

async function chatWithOpenAI(sessionHistory: MentorChatTurn[], userMessage: string): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY not configured");

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const run = client.chat.completions.create({
    model,
    messages: openAIMessages(sessionHistory, userMessage),
    temperature: GENERATION_CONFIG.temperature,
    max_tokens: GENERATION_CONFIG.maxOutputTokens,
  });

  const res = await withTimeout(run, LLM_TIMEOUT_MS, "OpenAI");
  const text = res.choices[0]?.message?.content;
  return text?.trim() || "I'm here — try rephrasing your question.";
}

async function* streamChatWithOpenAI(
  sessionHistory: MentorChatTurn[],
  userMessage: string,
): AsyncGenerator<string, void, undefined> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY not configured");

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const streamPromise = client.chat.completions.create({
    model,
    messages: openAIMessages(sessionHistory, userMessage),
    temperature: GENERATION_CONFIG.temperature,
    max_tokens: GENERATION_CONFIG.maxOutputTokens,
    stream: true,
  });

  const stream = await withTimeout(streamPromise, LLM_TIMEOUT_MS, "OpenAI");
  for await (const chunk of stream) {
    const t = chunk.choices[0]?.delta?.content;
    if (t) yield t;
  }
}

async function explainTopicWithOpenAI(topic: string, contextBlock: string): Promise<string> {
  const client = getOpenAIClient();
  if (!client) throw new Error("OPENAI_API_KEY not configured");

  const model = process.env.OPENAI_MODEL?.trim() || DEFAULT_OPENAI_MODEL;
  const prompt = `Explain this cybersecurity topic clearly for a student. Do not reveal flags or exact lab answers.\n\nTopic: ${topic}\n\nSession context (for relevance only):\n${contextBlock.slice(0, 6000)}`;

  const run = client.chat.completions.create({
    model,
    messages: [
      { role: "system", content: MENTOR_SYSTEM_PROMPT },
      { role: "user", content: prompt },
    ],
    temperature: GENERATION_CONFIG.temperature,
    max_tokens: GENERATION_CONFIG.maxOutputTokens,
  });

  const res = await withTimeout(run, LLM_TIMEOUT_MS, "OpenAI");
  return res.choices[0]?.message?.content?.trim() || "I could not generate an explanation.";
}

async function chatWithGemini(sessionHistory: MentorChatTurn[], userMessage: string): Promise<string> {
  const model = getGeminiModel();
  if (!model) throw new Error("GEMINI_API_KEY not configured");

  const run = model.generateContent({ contents: geminiContents(sessionHistory, userMessage) });
  const res = await withTimeout(run, LLM_TIMEOUT_MS, "Gemini");
  return res.response.text().trim() || "I'm here — try rephrasing your question.";
}

async function* streamChatWithGemini(
  sessionHistory: MentorChatTurn[],
  userMessage: string,
): AsyncGenerator<string, void, undefined> {
  const model = getGeminiModel();
  if (!model) throw new Error("GEMINI_API_KEY not configured");

  const streamPromise = model.generateContentStream({ contents: geminiContents(sessionHistory, userMessage) });
  const streamResult = await withTimeout(streamPromise, LLM_TIMEOUT_MS, "Gemini");

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

async function explainTopicWithGeminiInternal(topic: string, contextBlock: string): Promise<string> {
  const model = getGeminiModel();
  if (!model) throw new Error("GEMINI_API_KEY not configured");

  const prompt = `Explain this cybersecurity topic clearly for a student. Do not reveal flags or exact lab answers.\n\nTopic: ${topic}\n\nSession context (for relevance only):\n${contextBlock.slice(0, 6000)}`;
  const run = model.generateContent({ contents: [{ role: "user", parts: [{ text: prompt }] }] });
  const res = await withTimeout(run, LLM_TIMEOUT_MS, "Gemini");
  return res.response.text().trim() || "I could not generate an explanation.";
}

export async function chatWithMentor(sessionHistory: MentorChatTurn[], userMessage: string): Promise<string> {
  const provider = getMentorProvider();
  if (provider === "openai") return chatWithOpenAI(sessionHistory, userMessage);
  if (provider === "gemini") return chatWithGemini(sessionHistory, userMessage);
  throw new Error("No LLM API key configured (set OPENAI_API_KEY or GEMINI_API_KEY)");
}

export async function* streamChatWithMentor(
  sessionHistory: MentorChatTurn[],
  userMessage: string,
): AsyncGenerator<string, void, undefined> {
  const provider = getMentorProvider();
  if (provider === "openai") {
    yield* streamChatWithOpenAI(sessionHistory, userMessage);
    return;
  }
  if (provider === "gemini") {
    yield* streamChatWithGemini(sessionHistory, userMessage);
    return;
  }
  throw new Error("No LLM API key configured (set OPENAI_API_KEY or GEMINI_API_KEY)");
}

export async function explainTopicWithLlm(topic: string, contextBlock: string): Promise<string> {
  const provider = getMentorProvider();
  if (provider === "openai") return explainTopicWithOpenAI(topic, contextBlock);
  if (provider === "gemini") return explainTopicWithGeminiInternal(topic, contextBlock);
  throw new Error("No LLM API key configured (set OPENAI_API_KEY or GEMINI_API_KEY)");
}

/** @deprecated Use explainTopicWithLlm */
export const explainTopicWithGemini = explainTopicWithLlm;
