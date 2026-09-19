import { StrictMode, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { ArrowRight, BadgeCheck, Clock3, Heart, MapPin, Search, Sparkles, Utensils, WalletCards } from 'lucide-react';
import { fetchPlan } from './api/plan';
import type { PlanResponse } from './types';
import './styles.css';

const startingPlan: PlanResponse = { summary: 'Your shortlist will appear here.', options: [], savings: 0, checkedAt: '' };

function App() {
  const [prompt, setPrompt] = useState('Dinner for two tonight');
  const [budget, setBudget] = useState(25);
  const [dietary, setDietary] = useState('No preference');
  const [plan, setPlan] = useState(startingPlan);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function submit(event: React.FormEvent) {
    event.preventDefault(); setLoading(true); setError('');
    try { setPlan(await fetchPlan({ prompt, budget, dietary })); } catch (caught) { setError(caught instanceof Error ? caught.message : 'Something went wrong.'); } finally { setLoading(false); }
  }

  return <div className="app-shell">
    <header className="topbar"><a className="brand" href="/"><span className="brand-mark"><Sparkles size={17} /></span><span>neighborly</span></a><div className="location"><MapPin size={15} /> Mountain View, CA <span className="live-dot" /></div><button className="quiet-button"><Heart size={16} /> Saved <span className="saved-count">0</span></button></header>
    <main>
      <section className="hero"><div className="hero-copy"><p className="eyebrow"><span className="eyebrow-line" /> DELIVERY, MADE FAIR</p><h1>More dinner.<br /><em>Less spent.</em></h1><p className="hero-intro">Your neighborly AI for finding real delivery deals in Mountain View. Tell us what sounds good and we’ll do the price hunting.</p></div><div className="hero-stamp"><span>01</span><div>Deals checked<br /><strong>for you</strong></div></div></section>
      <section className="planner-grid">
        <form className="planner-panel" onSubmit={submit}><div className="panel-heading"><div><p className="section-kicker">01 / Your order</p><h2>What are we finding?</h2></div><span className="panel-icon"><Search size={19} /></span></div><label>Craving or occasion<input value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="e.g. vegetarian lunch for two" /></label><div className="field-row"><label>Max budget<div className="money-input"><span>$</span><input type="number" min="1" step="1" value={budget} onChange={(event) => setBudget(Number(event.target.value))} /></div></label><label>Dietary<select value={dietary} onChange={(event) => setDietary(event.target.value)}><option>No preference</option><option>Vegetarian</option><option>Vegan</option><option>Gluten-aware</option></select></label></div><button className="primary-button" disabled={loading}>{loading ? 'Checking local deals...' : <>Find my best value <ArrowRight size={18} /></>}</button><p className="fine-print"><BadgeCheck size={14} /> We only show offers we can verify.</p></form>
        <aside className="how-panel"><div className="how-top"><span className="section-kicker">A little magic, transparently</span><Sparkles size={22} /></div><h2>Good food should not require a lucky break.</h2><p>Neighborly checks promotions, delivery fees, and local disruptions together, so a “deal” stays a deal at checkout.</p><div className="trust-list"><div><WalletCards size={18} /><span><strong>Budget-first</strong><small>Fees included in every total</small></span></div><div><Clock3 size={18} /><span><strong>Time-aware</strong><small>Live ETAs, not vague promises</small></span></div></div></aside>
      </section>
      <section className="results"><div className="results-header"><div><p className="section-kicker">02 / Your shortlist</p><h2>Best value, right now</h2></div>{plan.options.length > 0 && <div className="savings-pill">You save <strong>${plan.savings.toFixed(2)}</strong></div>}</div>{error && <div className="error-message">{error}</div>}{plan.options.length === 0 && !error ? <div className="empty-state"><Utensils size={25} /><p>{plan.summary}</p><span>Set your budget and let’s find something good.</span></div> : <><p className="result-summary">{plan.summary}</p><div className="offer-grid">{plan.options.map((option, index) => <article className={`offer-card ${index === 0 ? 'featured' : ''}`} key={option.id}><div className="offer-top"><span className="deal-badge">{option.badge}</span><button className="icon-button" aria-label="Save offer"><Heart size={17} /></button></div><div className="offer-number">0{index + 1}</div><h3>{option.restaurant}</h3><p className="item-name">{option.item}</p><div className="offer-meta"><span><Clock3 size={14} /> {option.eta}</span><span><WalletCards size={14} /> {option.fee ? `$${option.fee.toFixed(2)} fee` : 'No delivery fee'}</span></div><div className="offer-bottom"><div><span className="offer-price">${(option.price + option.fee).toFixed(2)}</span><span className="was-price">${option.originalPrice.toFixed(2)}</span></div><button className="details-button">View deal <ArrowRight size={15} /></button></div></article>)}</div></>}</section>
    </main><footer><span>neighborly / a Mountain View delivery guide</span><span>Built for everyday budgets <span className="footer-dot">•</span> <a href="/health">System status</a></span></footer>
  </div>
}

createRoot(document.getElementById('root')!).render(<StrictMode><App /></StrictMode>);
