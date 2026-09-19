import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { ArrowRight, BadgeCheck, Check, ChevronDown, Clock3, Heart, MapPin, MessageCircle, Search, Sparkles, Utensils, WalletCards, X } from 'lucide-react';
import { fetchPlan } from './api/plan';
import { ChatPanel } from './components/ChatPanel';
import { AgentFilters } from './components/AgentFilters';
import type { DeliveryOption, PlanRequest, PlanResponse } from './types';

const startingPlan: PlanResponse = { summary: 'Your shortlist will appear here.', options: [], savings: 0, checkedAt: new Date().toISOString(), dataSource: 'verified-demo-data' };
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const quickSearches: Array<{ label: string } & PlanRequest> = [
  { label: 'Dinner for two', prompt: 'Dinner for two tonight', budget: 25, dietary: 'No preference' },
  { label: 'Vegetarian lunch', prompt: 'A filling vegetarian lunch', budget: 18, dietary: 'Vegetarian' },
  { label: 'Vegan under $15', prompt: 'Vegan dinner', budget: 15, dietary: 'Vegan' },
];

export default function App() {
  const [prompt, setPrompt] = useState('Dinner for two tonight');
  const [budget, setBudget] = useState(25);
  const [dietary, setDietary] = useState<PlanRequest['dietary']>('No preference');
  const [plan, setPlan] = useState(startingPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedIds, setSavedIds] = useState<string[]>([]);
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<DeliveryOption | null>(null);
  const [toast, setToast] = useState('');
  const [chatOpen, setChatOpen] = useState(false);
  const chatRegion = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!chatOpen) return;
    chatRegion.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    chatRegion.current?.querySelector('input')?.focus({ preventScroll: true });
  }, [chatOpen]);

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
    <header className="topbar"><a className="brand" href="/" aria-label="MealWise home"><span className="brand-mark"><Sparkles size={17} /></span><span>mealwise</span></a><div className="location"><MapPin size={15} /> Mountain View, CA <span className="live-dot" /></div><button className="chat-toggle" onClick={() => setChatOpen((current) => !current)} aria-expanded={chatOpen} aria-controls="mealwise-chat"><MessageCircle size={16} /> {chatOpen ? 'Close chat' : 'Chat with AI'}</button><button className={`quiet-button ${showSavedOnly ? 'active' : ''}`} onClick={() => setShowSavedOnly((current) => !current)} aria-pressed={showSavedOnly}><Heart size={16} fill={showSavedOnly ? 'currentColor' : 'none'} /> Saved <span className="saved-count">{savedIds.length}</span></button></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> DELIVERY, MADE FAIR</p><h1>More dinner.<br /><em>Less spent.</em></h1><p className="hero-intro">Your food-finding assistant for exploring delivery deals in Mountain View. Tell us what sounds good and we’ll do the price hunting.</p></div><div className="hero-stamp"><span>01</span><div>Preferences matched<br /><strong>for you</strong></div></div></section>
      <section className="planner-grid">
        <form className="planner-panel" onSubmit={submit}><div className="panel-heading"><div><p className="section-kicker">01 / Your order</p><h2>What are we finding?</h2></div><span className="panel-icon"><Search size={19} /></span></div><label htmlFor="craving">Craving or occasion<input id="craving" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. vegetarian lunch for two" required minLength={3} /></label><div className="field-row"><label htmlFor="budget">Max budget<div className="money-input"><span>$</span><input id="budget" type="number" min="1" step="1" value={budget} onChange={(event) => setBudget(Number(event.target.value))} required /></div></label><label htmlFor="dietary">Dietary<select id="dietary" value={dietary} onChange={(event) => setDietary(event.target.value as PlanRequest['dietary'])}><option>No preference</option><option>Vegetarian</option><option>Vegan</option><option>Gluten-aware</option></select></label></div><button className="primary-button" disabled={loading || !prompt.trim() || budget < 1}>{loading ? <><span className="button-spinner" /> Checking local deals...</> : <>Find my best value <ArrowRight size={18} /> </>}</button><p className="fine-print"><BadgeCheck size={14} /> Explore a demo catalog with estimated tax and fees.</p><div className="quick-searches"><span>Try a quick search</span>{quickSearches.map((search) => <button type="button" key={search.label} onClick={() => applyQuickSearch(search)}>{search.label}<ArrowRight size={13} /></button>)}</div></form>
        <aside className="how-panel"><div className="how-top"><span className="section-kicker">A little magic, transparently</span><Sparkles size={22} /></div><h2>Good food should not require a lucky break.</h2><p>Tell MealWise your dietary needs, cuisine, budget, and deal preferences. We’ll filter a simulated catalog and show the estimated cost for your group.</p><div className="trust-list"><div><WalletCards size={18} /><span><strong>Budget-first</strong><small>Estimated tax and fees included</small></span></div><div><Clock3 size={18} /><span><strong>Time-aware</strong><small>Filter by estimated arrival</small></span></div></div></aside>
      </section>
      <div ref={chatRegion} id="mealwise-chat" hidden={!chatOpen}><ChatPanel budget={budget} dietary={dietary} onPlan={(response) => { setPlan(response.plan); setShowSavedOnly(false); window.requestAnimationFrame(() => document.getElementById('shortlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }} /></div>
      <section className="results" id="shortlist"><div className="results-header"><div><p className="section-kicker">02 / Your shortlist</p><h2>{showSavedOnly ? 'Saved for later' : 'Your matching offers'}</h2></div>{plan.options.length > 0 && !showSavedOnly && <div className="savings-pill">Top match food savings <strong>${plan.savings.toFixed(2)}</strong></div>}</div><AgentFilters plan={plan} />{error && <div className="error-message"><span>{error}</span><button onClick={() => void submit()}>Try again <ArrowRight size={14} /></button></div>}{loading ? <div className="loading-grid">{[1, 2, 3].map((item) => <div className="loading-card" key={item}><span /><span /><span /><span /></div>)}</div> : visibleOptions.length === 0 ? <div className="empty-state"><Utensils size={25} /><p>{showSavedOnly ? 'No saved offers from this shortlist yet.' : plan.summary}</p><span>{showSavedOnly ? 'Tap the heart on a deal to keep it nearby.' : 'Set your budget and let’s find something good.'}</span>{showSavedOnly && <button className="text-button" onClick={() => setShowSavedOnly(false)}>Back to shortlist <ArrowRight size={14} /></button>}</div> : <><p className="result-summary">{plan.summary} <span className="checked-note"><Check size={13} /> Search completed</span></p><div className="offer-grid">{visibleOptions.map((option, index) => <OfferCard key={option.id} option={option} index={index} saved={savedIds.includes(option.id)} onSave={() => toggleSaved(option.id)} onView={() => setSelectedOffer(option)} />)}</div></>}</section>
    </main><footer><span>mealwise / a Mountain View delivery guide</span><span>Built for everyday budgets <span className="footer-dot">•</span> <a href={`${apiBaseUrl}/health`}>System status</a></span></footer>
    {selectedOffer && <OfferDialog offer={selectedOffer} saved={savedIds.includes(selectedOffer.id)} onSave={() => toggleSaved(selectedOffer.id)} onClose={() => setSelectedOffer(null)} />}{toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
  </div>;
}

function OfferCard({ option, index, saved, onSave, onView }: { option: DeliveryOption; index: number; saved: boolean; onSave: () => void; onView: () => void }) {
  return <article className={`offer-card ${index === 0 ? 'featured' : ''}`}><div className="offer-top"><span className="deal-badge">{option.badge}</span><button className={`icon-button ${saved ? 'saved' : ''}`} onClick={onSave} aria-label={saved ? `Remove ${option.restaurant} from saved offers` : `Save ${option.restaurant}`}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="offer-number">0{index + 1}</div><h3>{option.restaurant}</h3><p className="item-name">{option.item}</p><p className="offer-source">{option.source}</p><div className="offer-meta"><span><Clock3 size={14} /> {option.eta}</span><span><WalletCards size={14} /> {option.fee ? `$${option.fee.toFixed(2)} fee` : 'No delivery fee'}</span></div><div className="offer-bottom"><div><span className="offer-price">${(option.total ?? option.price + option.fee).toFixed(2)}</span><span className="was-price">{option.servings ?? 1} servings</span></div><button className="details-button" onClick={onView}>View deal <ArrowRight size={15} /></button></div></article>;
}

function OfferDialog({ offer, saved, onSave, onClose }: { offer: DeliveryOption; saved: boolean; onSave: () => void; onClose: () => void }) {
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="offer-dialog" role="dialog" aria-modal="true" aria-labelledby="offer-title"><button className="dialog-close" onClick={onClose} aria-label="Close offer details"><X size={18} /></button><span className="deal-badge">{offer.badge}</span><p className="section-kicker dialog-kicker">OFFER DETAILS</p><h2 id="offer-title">{offer.restaurant}</h2><p className="dialog-item">{offer.item}</p><p className="dialog-detail">{offer.detail}</p><div className="dialog-price"><span>Estimated group total</span><strong>${(offer.total ?? offer.price + offer.fee).toFixed(2)}</strong><small>Food ${offer.price.toFixed(2)} · delivery ${offer.fee.toFixed(2)} · service ${(offer.serviceFee ?? 0).toFixed(2)} · tax ${(offer.tax ?? 0).toFixed(2)}</small><small>{offer.quantity ?? 1} bundle(s), serving {offer.servings ?? 1} · food savings ${(offer.savings ?? offer.originalPrice - offer.price).toFixed(2)}</small><small>{offer.priceNote}</small></div><div className="dialog-facts"><span><Clock3 size={16} /><strong>{offer.eta}</strong><small>estimated arrival</small></span><span><BadgeCheck size={16} /><strong>Catalog source</strong><small>{offer.source}</small></span></div><div className="dialog-actions"><button className="primary-button" onClick={onClose}>Keep comparing <ChevronDown size={17} /></button><button className="secondary-button" onClick={onSave}><Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save offer'}</button></div></section></div>;
}
