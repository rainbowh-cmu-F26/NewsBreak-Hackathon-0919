import type { ChatRequest, ChatResponse } from '../../../shared/schemas';
import { chatResponseSchema } from '../../../shared/schemas';
import { postJson } from './request';

export async function sendChatMessage(request: ChatRequest): Promise<ChatResponse> {
  return chatResponseSchema.parse(await postJson('/api/chat', request));
}
