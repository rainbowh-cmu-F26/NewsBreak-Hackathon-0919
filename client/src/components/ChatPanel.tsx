import { useState, type FormEvent } from 'react';
import { ArrowUp, Bot } from 'lucide-react';
import { sendChatMessage } from '../api/chat';
import type { ChatResponse, PlanRequest } from '../types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function ChatPanel({ budget, dietary, onPlan }: { budget: number; dietary: PlanRequest['dietary']; onPlan: (response: ChatResponse) => void }) {
  const [conversationId, setConversationId] = useState<string>();
  const [message, setMessage] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: 'assistant', content: 'Tell me what you are craving and I will look for the best verified value.' }]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setMessage(''); setError(''); setLoading(true);
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    try {
      const response = await sendChatMessage({ conversationId, message: trimmed, budget, dietary });
      setConversationId(response.conversationId);
      setMessages((current) => [...current, { role: 'assistant', content: response.reply }]);
      onPlan(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The agent is unavailable.');
    } finally { setLoading(false); }
  }

  return <section className="chat-panel" aria-label="Chat with MealWise"><div className="chat-heading"><div><span className="chat-icon"><Bot size={17} /></span><div><p className="section-kicker">DIRECT LINE</p><h2>Ask MealWise</h2></div></div><span className="chat-status"><span /> Ready</span></div><div className="chat-messages" aria-live="polite">{messages.map((item, index) => <div className={`chat-message ${item.role}`} key={`${item.role}-${index}`}><span>{item.role === 'assistant' ? <Bot size={13} /> : 'You'}</span><p>{item.content}</p></div>)}{loading && <div className="chat-message assistant"><span><Bot size={13} /></span><p className="typing-dots">Thinking<span>.</span><span>.</span><span>.</span></p></div>}</div>{error && <p className="chat-error">{error}</p>}<form className="chat-form" onSubmit={submit}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Try: cheap vegan dinner for two" aria-label="Message MealWise" maxLength={500} /><button type="submit" disabled={loading || !message.trim()} aria-label="Send message"><ArrowUp size={17} /></button></form><p className="chat-note">Uses your ${budget} budget and {dietary.toLowerCase()} filter.</p></section>;
}
