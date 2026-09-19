import type { ChatRequest, ChatResponse } from '../../../shared/schemas';

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  const response = await fetch(`${import.meta.env.VITE_API_URL || 'http://localhost:8787'}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(request)
  });
  if (!response.ok) throw new Error('The agent could not answer right now. Please try again.');
  return response.json() as Promise<ChatResponse>;
}
