import { StrictMode, useEffect, useMemo, useState, type FormEvent } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BadgeCheck, Check, ChevronDown, Clock3, Heart, MapPin, MessageCircle, Search, Sparkles, Utensils, WalletCards, X } from 'lucide-react';
import { fetchPlan } from './api/plan';
import { ChatPanel } from './components/ChatPanel';
import type { DeliveryOption, PlanRequest, PlanResponse } from './types';
import { deliveryOptionSchema } from '../../shared/schemas';
import { foodPhoto } from './data/foodPhotos';
import { restaurantDescription } from './data/restaurantDescriptions';
import './styles.css';
import './interaction-styles.css';

const savedStorageKey = 'mealwise.saved-restaurants.v1';
const restaurantName = (name: string) => name.replace(/\s*\(Demo\)\s*$/i, '').trim();
const sameRestaurant = (a: DeliveryOption, b: DeliveryOption) => a.restaurant_id && b.restaurant_id
  ? a.restaurant_id === b.restaurant_id
  : restaurantName(a.restaurant).toLowerCase() === restaurantName(b.restaurant).toLowerCase();
function uniqueRestaurants(options: DeliveryOption[]): DeliveryOption[] {
  return options.reduce<DeliveryOption[]>((result, option) => {
    if (!result.some(existing => sameRestaurant(existing, option))) result.push(option);
    return result;
  }, []);
}

function loadSaved(): DeliveryOption[] {
  try {
    const parsed = deliveryOptionSchema.array().safeParse(JSON.parse(localStorage.getItem(savedStorageKey) || '[]'));
    return parsed.success ? uniqueRestaurants(parsed.data) : [];
  } catch { return []; }
}

const startingPlan: PlanResponse = { summary: 'Your shortlist will appear here.', options: [], savings: 0, checkedAt: new Date().toISOString(), dataSource: 'verified-demo-data' };
const apiBaseUrl = import.meta.env.VITE_API_URL || 'http://localhost:8787';
const quickSearches: Array<{ label: string } & PlanRequest> = [
  { label: 'Compare all 18', prompt: 'All restaurants', budget: 35, dietary: 'No preference' },
  { label: 'Rice under $20', prompt: 'rice', budget: 20, dietary: 'No preference' },
  { label: 'Paneer under $15', prompt: 'paneer', budget: 15, dietary: 'No preference' },
];

function App() {
  const [prompt, setPrompt] = useState('All restaurants');
  const [budget, setBudget] = useState(35);
  const [dietary, setDietary] = useState<PlanRequest['dietary']>('No preference');
  const [plan, setPlan] = useState(startingPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [savedRestaurants, setSavedRestaurants] = useState<DeliveryOption[]>(loadSaved);
  const isSaved = (option: DeliveryOption) => savedRestaurants.some(saved => sameRestaurant(saved, option));
  const [showSavedOnly, setShowSavedOnly] = useState(false);
  const [selectedOffer, setSelectedOffer] = useState<DeliveryOption | null>(null);
  const [toast, setToast] = useState('');
  const [chatOpen, setChatOpen] = useState(false);

  const visibleOptions = useMemo(() => uniqueRestaurants(showSavedOnly ? savedRestaurants : plan.options), [plan.options, savedRestaurants, showSavedOnly]);

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
      setPlan(await fetchPlan({ ...values, mode: 'simulation' }));
      window.requestAnimationFrame(() => document.getElementById('shortlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.');
    } finally { setLoading(false); }
  }

  function applyQuickSearch(search: typeof quickSearches[number]) {
    const request: PlanRequest = { prompt: search.prompt, budget: search.budget, dietary: search.dietary };
    setPrompt(search.prompt); setBudget(search.budget); setDietary(search.dietary); void submit(undefined, request);
  }

  function toggleSaved(option: DeliveryOption) {
    const exists = isSaved(option);
    const next = exists ? savedRestaurants.filter(saved => !sameRestaurant(saved, option)) : [...savedRestaurants, option];
    setSavedRestaurants(next);
    try {
      localStorage.setItem(savedStorageKey, JSON.stringify(next));
      setToast(exists ? 'Restaurant removed from saved' : 'Restaurant saved on this browser');
    } catch {
      setToast('Saved for this session only; browser storage is unavailable');
    }
  }

  function toggleSavedView() {
    setShowSavedOnly(current => !current);
    window.requestAnimationFrame(() => document.getElementById('shortlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/" aria-label="MealWise home"><span className="brand-mark"><Sparkles size={17} /></span><span>mealwise</span></a><div className="location"><MapPin size={15} /> Mountain View, CA <span className="live-dot" /></div><button className="chat-toggle" onClick={() => setChatOpen((current) => !current)} aria-expanded={chatOpen}><MessageCircle size={16} /> Chat with AI</button><button className={`quiet-button ${showSavedOnly ? 'active' : ''}`} onClick={toggleSavedView} aria-pressed={showSavedOnly}><Heart size={16} fill={showSavedOnly ? 'currentColor' : 'none'} /> Saved <span className="saved-count">{savedRestaurants.length}</span></button></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> DELIVERY, MADE FAIR</p><h1>More dinner.<br /><em>Less spent.</em></h1><p className="hero-intro">Compare 18 restaurant scenarios across Uber Eats, DoorDash, selected Grubhub offers and hypothetical restaurant delivery. Four use real menu references; fourteen are fictional demo restaurants. All checkout prices are simulated.</p></div><div className="hero-stamp"><span>01</span><div>Deals checked<br /><strong>for you</strong></div></div></section>
      <section className="planner-grid">
        <form className="planner-panel" onSubmit={submit}><div className="panel-heading"><div><p className="section-kicker">01 / Your order</p><h2>What are we finding?</h2></div><span className="panel-icon"><Search size={19} /></span></div><label htmlFor="craving">Craving or occasion<input id="craving" value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. vegetarian lunch for two" required minLength={3} /></label><div className="field-row"><label htmlFor="budget">Demo total budget<div className="money-input"><span>$</span><input id="budget" type="number" min="1" step="1" value={budget} onChange={(event) => setBudget(Number(event.target.value))} required /></div></label><label htmlFor="dietary">Dietary<select id="dietary" value={dietary} onChange={(event) => setDietary(event.target.value as PlanRequest['dietary'])}><option>No preference</option><option>Vegetarian</option><option>Vegan</option><option>Gluten-aware</option></select></label></div><button className="primary-button" disabled={loading || !prompt.trim() || budget < 1}>{loading ? <><span className="button-spinner" /> Checking local deals...</> : <>Find my best value <ArrowRight size={18} /> </>}</button><p className="fine-print"><BadgeCheck size={14} /> Demo · 18 restaurants · 3–4 simulated delivery options each.</p><div className="quick-searches"><span>Try a quick search</span>{quickSearches.map((search) => <button type="button" key={search.label} onClick={() => applyQuickSearch(search)}>{search.label}<ArrowRight size={13} /></button>)}</div></form>
        <aside className="how-panel"><div className="how-top"><span className="section-kicker">A little magic, transparently</span><Sparkles size={22} /></div><h2>Good food should not require a lucky break.</h2><p>Compare the same meal with the same $2 tip. Each card shows simulated platform totals and highlights the cheapest. Restaurant delivery is hypothetical; no real service availability is claimed.</p><div className="trust-list"><div><WalletCards size={18} /><span><strong>Budget-first</strong><small>Simulated fees included</small></span></div><div><Clock3 size={18} /><span><strong>Time-aware</strong><small>Simulated delivery estimate</small></span></div></div></aside>
      </section>
      {chatOpen && <ChatPanel budget={budget} dietary={dietary} onPlan={(response) => { setPlan(response.plan); setShowSavedOnly(false); window.requestAnimationFrame(() => document.getElementById('shortlist')?.scrollIntoView({ behavior: 'smooth', block: 'start' })); }} />}
      <section className="results" id="shortlist"><div className="results-header"><div><p className="section-kicker">02 / Your shortlist</p><h2>{showSavedOnly ? 'Saved for later' : 'Best match at each restaurant'}</h2></div>{plan.savings > 0 && !showSavedOnly && <div className="savings-pill">You save <strong>${plan.savings.toFixed(2)}</strong></div>}</div>{error && <div className="error-message"><span>{error}</span><button onClick={() => void submit()}>Try again <ArrowRight size={14} /></button></div>}{loading && !showSavedOnly ? <div className="loading-grid">{[1, 2, 3].map((item) => <div className="loading-card" key={item}><span /><span /><span /><span /></div>)}</div> : visibleOptions.length === 0 ? <div className="empty-state"><Utensils size={25} /><p>{showSavedOnly ? 'No saved restaurants yet.' : plan.summary}</p><span>{showSavedOnly ? 'Tap the heart on a deal to keep it nearby.' : 'Set your budget and let’s find something good.'}</span>{showSavedOnly && <button className="text-button" onClick={() => setShowSavedOnly(false)}>Back to shortlist <ArrowRight size={14} /></button>}</div> : <><p className="result-summary">{showSavedOnly ? `${savedRestaurants.length} saved restaurants. Prices are snapshots from when you saved; they do not refresh automatically.` : plan.summary} <span className="checked-note"><Check size={13} /> Stored quotes · not live</span></p><div className="offer-grid">{visibleOptions.map((option, index) => <OfferCard key={option.restaurant_id || option.id} option={option} index={index} ranked={!showSavedOnly} saved={isSaved(option)} onSave={() => toggleSaved(option)} onView={() => setSelectedOffer(option)} />)}</div></>}</section>
    </main><footer><span>mealwise / a Mountain View delivery guide</span><span>Built for everyday budgets <span className="footer-dot">•</span> <a href={`${apiBaseUrl}/health`}>System status</a></span></footer>
    {selectedOffer && <OfferDialog offer={selectedOffer} saved={isSaved(selectedOffer)} onSave={() => toggleSaved(selectedOffer)} onClose={() => setSelectedOffer(null)} />}{toast && <div className="toast" role="status"><Check size={16} /> {toast}</div>}
  </div>;
}


const platformLabel = (id: string) => ({ grubhub: 'Grubhub', ubereats: 'Uber Eats', doordash: 'DoorDash', restaurant_direct: 'Restaurant delivery' }[id] || id);
function PlatformComparison({option, detailed = false}: {option: DeliveryOption; detailed?: boolean}) {
 const lowest = Math.min(...(option.comparisons || []).map(c=>c.total));
 return <div className="platform-comparison"><p className="fine-print">Same meal · simulated totals · $2 tip included</p>{option.comparisons?.map(c=><div key={c.platform} className={`platform-row ${c.total === lowest ? 'platform-best' : ''}`}><div className="platform-line"><span>{platformLabel(c.platform)} {c.total === lowest && <strong className="platform-tag">Lowest</strong>}</span><strong>${(c.total/100).toFixed(2)}</strong></div>{detailed && <><small>{c.eta} · simulated</small><dl>{[['Items',c.subtotal],['Delivery',c.delivery],['Service',c.service],['Tax (assumed)',c.tax],['Tip',c.tip],['Discount (subtract)',c.discount]].map(([label,value])=><div className="platform-line" key={label}><dt>{label}</dt><dd>${(Number(value)/100).toFixed(2)}</dd></div>)}</dl></>}</div>)}<small>Restaurant delivery availability is hypothetical.</small></div>;
}

function FoodPhoto({ item, restaurant, large = false }: { item: string; restaurant: string; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return <div className={`food-photo ${large ? 'food-photo-large' : ''}`}>
    {!failed ? <img src={foodPhoto(item, restaurant)} alt={`Illustrative food photography for ${item}; not the restaurant's actual dish`} loading={large ? 'eager' : 'lazy'} onError={() => setFailed(true)} /> : <div className="food-photo-fallback"><Utensils size={42}/><span>Photo unavailable</span></div>}
    <span className="photo-label">Illustrative photo · Unsplash</span>
  </div>;
}

function OfferCard({ option, index, ranked, saved, onSave, onView }: { option: DeliveryOption; index: number; ranked: boolean; saved: boolean; onSave: () => void; onView: () => void }) {
  return <article className={`offer-card ${ranked && index === 0 ? 'featured' : ''}`}><button type="button" className="restaurant-cover" onClick={onView} aria-label={`View photos and prices for ${restaurantName(option.restaurant)}`}><FoodPhoto key={option.restaurant} item={option.item} restaurant={option.restaurant}/><span className="cover-cta">Explore meal <ArrowRight size={15}/></span></button><div className="offer-top"><span className="deal-badge">{option.badge}</span><button className={`icon-button ${saved ? 'saved' : ''}`} onClick={onSave} aria-label={saved ? `Remove ${restaurantName(option.restaurant)} from saved offers` : `Save ${restaurantName(option.restaurant)}`}><Heart size={17} fill={saved ? 'currentColor' : 'none'} /></button></div><div className="offer-number">{String(index + 1).padStart(2, "0")}</div><h3><button className="restaurant-title" onClick={onView}>{restaurantName(option.restaurant)}</button></h3><p className="item-name">{option.item}</p><p className="fine-print">{!ranked ? "Saved price snapshot" : index === 0 ? "Lowest total among these restaurant matches" : "Best matching option at this restaurant"}</p><div className="offer-meta"><span><Clock3 size={14} /> {option.eta}</span><span><WalletCards size={14} /> {option.quote?.dataType === 'menu_only' ? 'Menu price · fees unknown' : option.quote ? `${option.quote.platform} · total includes fees` : 'Fees included'}</span></div>{option.comparisons && <PlatformComparison option={option} />}<div className="offer-bottom"><div><span className="offer-price">${(option.price + option.fee).toFixed(2)}</span></div><button className="details-button" onClick={onView}>View best option <ArrowRight size={15} /></button></div></article>;
}

function OfferDialog({ offer, saved, onSave, onClose }: { offer: DeliveryOption; saved: boolean; onSave: () => void; onClose: () => void }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', close);
    return () => { document.body.style.overflow = previous; document.removeEventListener('keydown', close); };
  }, [onClose]);
  return <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => event.target === event.currentTarget && onClose()}><section className="offer-dialog" role="dialog" aria-modal="true" aria-labelledby="offer-title"><FoodPhoto key={offer.restaurant} item={offer.item} restaurant={offer.restaurant} large/><button className="dialog-close" onClick={onClose} aria-label="Close offer details"><X size={18} /></button><p className="section-kicker dialog-kicker">ABOUT THE RESTAURANT</p><h2 id="offer-title">{restaurantName(offer.restaurant)}</h2><p className="dialog-detail">{restaurantDescription(offer.restaurant)}</p><p className="dialog-item">{offer.item}</p>{offer.sourceOffer && <details className="price-methodology"><summary>Meal &amp; ingredient details · serves {offer.sourceOffer.servings}</summary><p>BOGO is already included in the bundle price. Original bundle menu price: ${offer.sourceOffer.originalPrice.toFixed(2)}.</p><p>Ingredients: {offer.sourceOffer.ingredients.join(', ')}.</p><p>Listed allergens: {offer.sourceOffer.allergens.join(', ') || 'None listed'}.</p><p>May contain: {offer.sourceOffer.mayContain.join(', ') || 'None listed'}.</p><p>Simulated ingredient and allergy information; not independently verified. Confirm dietary suitability with the restaurant.</p></details>}<p className="photo-disclosure">Food photography is illustrative and does not show this restaurant’s actual dish or storefront.</p><details className="price-methodology"><summary>About these prices</summary><p className="dialog-detail">{offer.detail}</p></details>{offer.sourceUrl && <a href={offer.sourceUrl} target="_blank" rel="noreferrer">View source on platform ↗</a>}<div className="dialog-price"><span>{offer.quote?.dataType === 'menu_only' ? 'Menu price · before fees' : offer.quote?.dataType === 'synthetic' ? 'Simulated total · not a live quote' : 'Recorded total'}</span><strong>${(offer.price + offer.fee).toFixed(2)}</strong></div><div className="dialog-facts"><span><Clock3 size={16} /><strong>{offer.eta}</strong><small>estimated arrival · demo when simulated</small></span><span><BadgeCheck size={16} /><strong>{offer.quote?.dataType === 'menu_only' ? 'Public menu' : offer.verified ? 'Snapshot checked' : 'Simulated'}</strong><small>{offer.quote?.capturedAt ? new Date(offer.quote.capturedAt).toLocaleString() : "No live capture"}</small></span></div>{offer.quote && <dl>{[
    ['Items', offer.quote.subtotal], ['Delivery', offer.quote.delivery], ['Service', offer.quote.service],
    ['Tax', offer.quote.tax], ...(offer.quote.combined === null ? [] : [['Combined tax / fees (not additive)', offer.quote.combined]]),
    ...offer.quote.other.map(x => [x.name, x.amount_cents]), ['Tip', offer.quote.tip], ['Additional discount (subtract)', offer.quote.discount]
  ].map(([label, cents]) => <div key={String(label)} style={{ display: 'flex', justifyContent: 'space-between', gap: 16, margin: '6px 0' }}><dt>{label}</dt><dd>{cents === null ? 'Not separately recorded' : `$${(Number(cents) / 100).toFixed(2)}`}</dd></div>)}</dl>}{offer.comparisons && <PlatformComparison option={offer} detailed />}<div className="dialog-actions"><button className="primary-button" onClick={onClose}>Keep comparing <ChevronDown size={17} /></button><button className="secondary-button" onClick={onSave}><Heart size={16} fill={saved ? 'currentColor' : 'none'} /> {saved ? 'Saved' : 'Save offer'}</button></div></section></div>;
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
