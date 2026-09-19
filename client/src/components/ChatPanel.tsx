import { useEffect, useRef, useState, type FormEvent } from 'react';
import { ArrowUp, Bot } from 'lucide-react';
import { sendChatMessage } from '../api/chat';
import type { ChatResponse, PlanRequest } from '../types';

type ChatMessage = { role: 'user' | 'assistant'; content: string };

export function ChatPanel({ budget, dietary, onPlan }: { budget: number; dietary: PlanRequest['dietary']; onPlan: (response: ChatResponse) => void }) {
  const [conversationId, setConversationId] = useState<string>();
  const [message, setMessage] = useState('');
  const greeting: ChatMessage = { role: 'assistant', content: 'Tell me your cuisine, diet, budget, and any deals you want. Try “vegan Mexican BOGO for two under $20”. I’ll search the demo catalog and remember your preferences.' };
  const [messages, setMessages] = useState<ChatMessage[]>([greeting]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const messageList = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Show the latest reply inside the chat without scrolling the page.
    const list = messageList.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, loading]);

  async function submit(event: FormEvent) {
    event.preventDefault();
    const trimmed = message.trim();
    if (!trimmed || loading) return;
    setMessage(''); setError(''); setLoading(true);
    setMessages((current) => [...current, { role: 'user', content: trimmed }]);
    try {
      const response = await sendChatMessage({ conversationId, message: trimmed, budget, dietary });
      setConversationId(response.conversationId);
      const reply = response.plan.options.length
        ? `${response.reply}\n\nI’ve listed your meal options and descriptions below. Scroll down whenever you’re ready to compare them.`
        : response.reply;
      setMessages((current) => [...current, { role: 'assistant', content: reply }]);
      onPlan(response);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'The agent is unavailable.');
      setMessage(trimmed);
    } finally { setLoading(false); }
  }

  return <section className="chat-panel" aria-label="Chat with MealWise">
    <div className="chat-heading"><div><span className="chat-icon"><Bot size={17} /></span><div><p className="section-kicker">FOOD FINDER</p><h2>Ask MealWise</h2></div></div><button type="button" className="text-button" disabled={loading} onClick={() => { setConversationId(undefined); setMessages([greeting]); setMessage(''); setError(''); }}>New chat</button></div>
    <div ref={messageList} className="chat-messages" aria-live="polite">{messages.map((item, index) => <div className={`chat-message ${item.role}`} key={`${item.role}-${index}`}><span>{item.role === 'assistant' ? <Bot size={13} /> : 'You'}</span><p style={{ whiteSpace: 'pre-line' }}>{item.content}</p></div>)}{loading && <div className="chat-message assistant"><span><Bot size={13} /></span><p className="typing-dots">Finding matches<span>.</span><span>.</span><span>.</span></p></div>}</div>
    {error && <p className="chat-error" role="alert">{error}</p>}
    <form className="chat-form" onSubmit={submit}><input value={message} onChange={(event) => setMessage(event.target.value)} placeholder="Vegan Mexican BOGO for two under $20" aria-label="Message MealWise" minLength={3} maxLength={500} disabled={loading} /><button type="submit" disabled={loading || message.trim().length < 3} aria-label="Send message"><ArrowUp size={17} /></button></form>
    <p className="chat-note">Starts with your ${budget} budget and {dietary.toLowerCase()} filter. Chat can change these; follow-ups retain your preferences. All current offers are simulated.</p>
  </section>;
}
