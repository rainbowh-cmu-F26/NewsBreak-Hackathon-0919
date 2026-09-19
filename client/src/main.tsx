import { StrictMode, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BadgeCheck, Check, Clock3, Heart, MapPin, MessageCircle, Search, Sparkles, Utensils, WalletCards } from 'lucide-react';
import { fetchPlan } from './api/plan';
import { ChatPanel } from './components/ChatPanel';
import { PlatformComparison } from './components/PlatformComparison';
import type { PlanRequest, PlanResponse } from './types';
import './styles.css';
import './interaction-styles.css';

// Fixed UI preview only; no backend or database connection is required.
const startingPlan: PlanResponse = {
  summary: 'Two sample meals for previewing the comparison layout.',
  options: [
    { id: 'p1', restaurant: 'Little Hunan', item: 'Vegetable Chow Fun', price: 20, originalPrice: 20, fee: 2.99, eta: '25–35 min', badge: 'UI sample', detail: 'Illustrative menu item', tags: ['vegetarian'], available: true, verified: false, source: 'Frontend UI fixture', verifiedAt: '' },
    { id: 'p4', restaurant: 'Green Garden', item: 'Tofu banh mi duo', price: 10, originalPrice: 10, fee: 1.99, eta: '20–30 min', badge: 'UI sample', detail: 'Illustrative menu set', tags: ['vegan', 'vegetarian'], available: true, verified: false, source: 'Frontend UI fixture', verifiedAt: '' },
  ],
  savings: 0, checkedAt: '2026-09-19T00:00:00.000Z', dataSource: 'verified-demo-data',
};
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const quickSearches: Array<{ label: string } & PlanRequest> = [
  { label: 'Dinner for two', prompt: 'Dinner for two tonight', budget: 25, dietary: 'No preference' },
  { label: 'Vegetarian lunch', prompt: 'A filling vegetarian lunch', budget: 18, dietary: 'Vegetarian' },
  { label: 'Vegan under $15', prompt: 'Vegan dinner', budget: 15, dietary: 'Vegan' },
];

function App() {
  const [prompt, setPrompt] = useState('Dinner for two tonight');
  const [budget, setBudget] = useState(25);
  const [dietary, setDietary] = useState<PlanRequest['dietary']>('No preference');
  const [plan, setPlan] = useState(startingPlan);
  const [isPreview, setIsPreview] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [toast, setToast] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const chatRegion = useRef<HTMLDivElement>(null);

  function focusChat() {
    chatRegion.current?.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'center',
    });
    chatRegion.current?.querySelector('input')?.focus({ preventScroll: true });
  }

  useEffect(() => {
    if (chatOpen) focusChat();
  }, [chatOpen]);

  function openChat() {
    setChatOpen(true);
    // Returning to an already-open chat should scroll to it again.
    if (chatOpen) focusChat();
  }

  const visibleOptions = useMemo(() => showSavedOnly ? plan.options.filter((option) => savedIds.includes(option.id)) : plan.options, [plan.options, savedIds, showSavedOnly]);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = window.setTimeout(() => setToast(''), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  async function submit(event?: FormEvent, nextValues?: PlanRequest) {
    event?.preventDefault();
    setLoading(true); setError(''); setShowSavedOnly(false);
    try {
      const values = nextValues ?? { prompt: prompt.trim(), budget, dietary };
      setPlan(await fetchPlan(values));
      setIsPreview(false);
      window.requestAnimationFrame(() => document.getElementById('shortlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally { setLoading(false); }
  }

  function applyQuickSearch(search: typeof quickSearches[number]) {
    const request: PlanRequest = { prompt: search.prompt, budget: search.budget, dietary: search.dietary };
    setPrompt(search.prompt); setBudget(search.budget); setDietary(search.dietary); void submit(undefined, request);
  }

  function toggleSaved(id: string) {
    const isSaved = savedIds.includes(id);
    setSavedIds((current) => isSaved ? current.filter((savedId) => savedId !== id) : [...current, id]);
    setToast(isSaved ? 'Removed from saved offers' : 'Saved for later');
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="MealWise home"><span className="brand-mark"><Sparkles size={17} /></span><span>mealwise</span></a><div className="location"><MapPin size={15} /> Mountain View, CA <span className="live-dot" /></div><button className="chat-toggle" onClick={openChat} aria-expanded={chatOpen} aria-controls="mealwise-chat"><MessageCircle size={16} /> Chat with AI</button><button className={`quiet-button ${showSavedOnly ? 'active' : ''}`} onClick={() => setShowSavedOnly((current) => !current)} aria-pressed={showSavedOnly}><Heart size={16} fill={showSavedOnly ? 'currentColor' : 'none'} /> Saved <span className="saved-count">{savedIds.length}</span></button></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> DELIVERY, MADE FAIR</p><h1>More dinner.<br /><em>Less spent.</em></h1><p className="hero-intro">Explore sample delivery prices for meals in Mountain View. Tell us what sounds good and we’ll do the price hunting.</p></div><div className="hero-stamp"><span>01</span><div>Sample prices<br /><strong>side by side</strong></div></div></section>
      <section className="planner-grid">
        <form className="planner-panel" onSubmit={submit}><div className="panel-heading"><div><p className="section-kicker">01 / Your order</p><h2>What are we finding?</h2></div><span className="panel-icon"><Search size={19} /></span></div><label htmlFor="craving">Craving or occasion<input id="craving" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. vegetarian lunch for two" required minLength={3} /></label><div className="field-row"><label htmlFor="budget">Max budget<div className="money-input"><span>$</span><input id="budget" type="number" min="1" step="1" value={budget} onChange={(event) => setBudget(Number(event.target.value))} required /></div></label><label htmlFor="dietary">Dietary<select id="dietary" value={dietary} onChange={(event) => setDietary(event.target.value as PlanRequest['dietary'])}><option>No preference</option><option>Vegetarian</option><option>Vegan</option><option>Gluten-aware</option></select></label></div><button className="primary-button" disabled={loading || !prompt.trim() || budget < 1}>{loading ? <><span className="button-spinner" /> Checking local deals...</> : <>Find my best value <ArrowRight size={18} /> </>}</button><p className="fine-print"><BadgeCheck size={14} /> Demo prices · personal coupons not included.</p><div className="quick-searches"><span>Try a quick search</span>{quickSearches.map((search) => <button type="button" key={search.label} onClick={() => applyQuickSearch(search)}>{search.label}<ArrowRight size={13} /></button>)}</div></form>
        <aside className="how-panel"><div className="how-top"><span className="section-kicker">A little magic, transparently</span><Sparkles size={22} /></div><h2>Good food should not require a lucky break.</h2><p>Compare the same meal across platforms, with a clear breakdown of food, delivery, service fees, and estimated tax. This prototype uses illustrative quotes.</p><div className="trust-list"><div><WalletCards size={18} /><span><strong>Budget-first</strong><small>See each fee separately</small></span></div><div><Clock3 size={18} /><span><strong>Time-aware</strong><small>Compare sample delivery times</small></span></div></div></aside>
      </section>
      <div ref={chatRegion} id="mealwise-chat" hidden={!chatOpen}><ChatPanel budget={budget} dietary={dietary} onPlan={(response) => { setPlan(response.plan); setIsPreview(false); setShowSavedOnly(false); }} /></div>
      <section className="results" id="shortlist" aria-busy={loading}>
        <div className="results-header"><div><p className="section-kicker">02 / Compare delivery prices</p><h2>{showSavedOnly ? 'Saved meal comparisons' : 'Same meal. Compare the total.'}</h2></div><span className="demo-label">DEMO · SAMPLE PRICES</span></div>
        <p className="comparison-note">Compare one listed meal or set across two platforms. All quotes below are illustrative, not live platform prices. Personal coupons, memberships, and tips are not included. These quotes may exceed your budget.</p>
        <div className="preview-toolbar"><span>{isPreview ? 'UI preview: two fixed sample meals. Search and chat require the backend.' : 'Meals returned by the demo planner; platform quotes are still UI samples.'}</span><button type="button" className="text-button" disabled={loading} onClick={() => { setPlan(startingPlan); setIsPreview(true); setShowSavedOnly(false); setError(''); }}>Load sample comparisons <ArrowRight size={14} /></button></div>
        {error && <div className="error-message" role="alert"><span>{error}</span><button onClick={() => void submit()}>Try again <ArrowRight size={14} /></button></div>}
        {loading ? <div className="loading-grid" aria-label="Loading comparisons">{[1, 2, 3].map((item) => <div className="loading-card" key={item}><span /><span /><span /><span /></div>)}</div> : visibleOptions.length === 0 ? <div className="empty-state"><Utensils size={25} /><p>{showSavedOnly ? 'No saved meals in these results.' : plan === startingPlan ? 'Your meal comparisons will appear here.' : 'No meals returned by the demo planner.'}</p><span>{showSavedOnly ? 'Tap a heart to save a meal comparison.' : 'Try another meal or adjust your budget.'}</span>{showSavedOnly && <button className="text-button" onClick={() => setShowSavedOnly(false)}>Back to comparisons <ArrowRight size={14} /></button>}</div> : <div className="comparison-list">{visibleOptions.map((option) => <PlatformComparison key={option.id} option={option} budget={budget} saved={savedIds.includes(option.id)} onSave={() => toggleSaved(option.id)} />)}</div>}
      </section>
    </main><footer><span>mealwise / a Mountain View delivery guide</span><span>Built for everyday budgets <span className="footer-dot">•</span> <a href={`${apiBaseUrl}/health`}>System status</a></span></footer>
    {toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
  </div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
