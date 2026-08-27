import { assertEquals, assertRejects } from "jsr:@std/assert@^1.0.0";
import { GeminiProvider } from "../src/llm/client.ts";

Deno.test("GeminiProvider - successful API call and parsing", async () => {
  const originalFetch = globalThis.fetch;
  let interceptedUrl = "";
  let interceptedHeaders: Record<string, string> = {};
  let interceptedBody: any = null;

  try {
    globalThis.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
      interceptedUrl = String(input);
      interceptedHeaders = init?.headers as Record<string, string>;
      interceptedBody = JSON.parse(init?.body as string);

      const mockResponseData = {
        steps: [
          {
            type: "model_output",
            content: [
              {
                type: "text",
                text: "## Goal\nTest Summary",
              },
            ],
          },
        ],
        usage: {
          total_input_tokens: 120,
          total_output_tokens: 45,
        },
      };

      return Promise.resolve(
        new Response(JSON.stringify(mockResponseData), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    }) as typeof globalThis.fetch;

    const provider = new GeminiProvider("fake-api-key", "gemini-2.5-flash");
    const response = await provider.call("system instruction text", "user input text");

    assertEquals(interceptedUrl, "https://generativelanguage.googleapis.com/v1beta/interactions");
    assertEquals(interceptedHeaders["x-goog-api-key"], "fake-api-key");
    assertEquals(interceptedHeaders["Content-Type"], "application/json");
    assertEquals(interceptedBody.model, "gemini-2.5-flash");
    assertEquals(interceptedBody.system_instruction, "system instruction text");
    assertEquals(interceptedBody.input, "user input text");

    assertEquals(response.text, "## Goal\nTest Summary");
    assertEquals(response.usage, { inputTokens: 120, outputTokens: 45 });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("GeminiProvider - HTTP error response throws descriptive error", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (() => {
      return Promise.resolve(
        new Response("API key not valid. Please pass a valid API key.", {
          status: 400,
          statusText: "Bad Request",
        }),
      );
    }) as typeof globalThis.fetch;

    const provider = new GeminiProvider("bad-key", "gemini-2.5-flash");

    await assertRejects(
      async () => {
        await provider.call("sys", "user");
      },
      Error,
      "Gemini API error: 400 API key not valid",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("GeminiProvider - handles missing model_output step by throwing", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (() => {
      const mockResponseData = {
        steps: [
          { type: "other_step", content: [] },
        ],
        usage: { total_input_tokens: 10, total_output_tokens: 10 },
      };
      return Promise.resolve(
        new Response(JSON.stringify(mockResponseData), { status: 200 }),
      );
    }) as typeof globalThis.fetch;

    const provider = new GeminiProvider("fake-key", "gemini-2.5-flash");

    await assertRejects(
      async () => {
        await provider.call("sys", "user");
      },
      TypeError,
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("GeminiProvider - network failure (fetch throws) is propagated", async () => {
  const originalFetch = globalThis.fetch;

  try {
    globalThis.fetch = (() => {
      return Promise.reject(new TypeError("Failed to fetch"));
    }) as typeof globalThis.fetch;

    const provider = new GeminiProvider("fake-key", "gemini-2.5-flash");

    await assertRejects(
      async () => {
        await provider.call("sys", "user");
      },
      TypeError,
      "Failed to fetch",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

