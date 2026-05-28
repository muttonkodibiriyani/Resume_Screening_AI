import OpenAI from 'openai';
import { AIError, classifyError } from './errors';

export interface AzureOpenAICallOpts {
  temperature?: number;
  maxTokens?: number;
  signal?: AbortSignal;
}

export async function callAzureOpenAI(prompt: string, opts: AzureOpenAICallOpts = {}): Promise<{ text: string; model: string }> {
  const apiKey = process.env.AZURE_OPENAI_API_KEY;
  const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
  const deployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini';
  const apiVersion = process.env.AZURE_OPENAI_API_VERSION || '2024-08-01-preview';

  if (!apiKey || !endpoint) {
    throw new AIError({
      kind: 'not_configured',
      provider: 'azure-openai',
      message: 'Azure OpenAI not configured',
      hint: 'Set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT in .env.local.',
    });
  }

  try {
    const client = new OpenAI({
      apiKey,
      baseURL: `${endpoint.replace(/\/$/, '')}/openai/deployments/${deployment}`,
      defaultQuery: { 'api-version': apiVersion },
      defaultHeaders: { 'api-key': apiKey },
    });

    const completion = await client.chat.completions.create(
      {
        model: deployment,
        messages: [
          { role: 'system', content: 'You are a strict JSON-only API. Always return valid JSON. Never include markdown code fences.' },
          { role: 'user', content: prompt },
        ],
        temperature: opts.temperature ?? 0.2,
        max_tokens: opts.maxTokens ?? 4096,
        response_format: { type: 'json_object' },
      },
      opts.signal ? { signal: opts.signal } : undefined,
    );
    return { text: completion.choices[0]?.message?.content || '{}', model: deployment };
  } catch (err) {
    throw classifyError('azure-openai', err);
  }
}
