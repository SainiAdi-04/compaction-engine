import { LLMProvider, LLMResponse } from "../types.ts";

export class GeminiProvider implements LLMProvider {
  constructor(private apiKey: string, private model: string) {}

  async call(systemPrompt: string, userMessage: string): Promise<LLMResponse> {
    const url = "https://generativelanguage.googleapis.com/v1beta/interactions";

    const requestBody = {
      model: this.model,
      system_instruction: systemPrompt,
      input: userMessage,
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": this.apiKey,
      },
      body: JSON.stringify(requestBody),
    });

    if (!response.ok) {
      throw new Error(
        `Gemini API error: ${response.status} ${await response.text()}`,
      );
    }

    const data = await response.json();

    const outputStep = data.steps.find((s: any) => s.type === "model_output");
    const text = outputStep.content.find((c: any) => c.type === "text").text;

    const usage = {
      inputTokens: data.usage.total_input_tokens,
      outputTokens: data.usage.total_output_tokens,
    };

    return { text, usage };
  }
}
