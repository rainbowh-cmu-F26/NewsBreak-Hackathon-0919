import { Heart } from 'lucide-react';
import type { DeliveryOption } from '../types';
import './platform-comparison.css';

type Quote = { platform: string; subtotal: number; delivery: number; service: number; tax: number; eta: string };
// Explicit UI fixtures, not provider quotes. Replace this adapter with API data
// once the shared data model is agreed. All monetary amounts are integer cents.
const demoQuotes: Record<string, Quote[]> = {
  p1: [
    { platform: 'Uber Eats', subtotal: 2000, delivery: 299, service: 150, tax: 180, eta: '25–35 min' },
    { platform: 'DoorDash', subtotal: 2100, delivery: 99, service: 100, tax: 189, eta: '30–40 min' },
  ],
  p2: [
    { platform: 'Uber Eats', subtotal: 1400, delivery: 199, service: 150, tax: 126, eta: '30–40 min' },
    { platform: 'DoorDash', subtotal: 1500, delivery: 299, service: 125, tax: 135, eta: '25–35 min' },
  ],
  p3: [
    { platform: 'Uber Eats', subtotal: 1200, delivery: 199, service: 100, tax: 108, eta: '35–45 min' },
    { platform: 'DoorDash', subtotal: 1150, delivery: 299, service: 125, tax: 104, eta: '30–40 min' },
  ],
  p4: [
    { platform: 'Uber Eats', subtotal: 1000, delivery: 199, service: 100, tax: 90, eta: '20–30 min' },
    { platform: 'DoorDash', subtotal: 1100, delivery: 99, service: 100, tax: 99, eta: '25–35 min' },
  ],
};
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`;
const total = (quote: Quote) => quote.subtotal + quote.delivery + quote.service + quote.tax;
const rows: Array<{ label: string; key: 'subtotal' | 'delivery' | 'service' | 'tax' }> = [
  { label: 'Food subtotal', key: 'subtotal' }, { label: 'Delivery fee', key: 'delivery' },
  { label: 'Service fee', key: 'service' }, { label: 'Estimated tax', key: 'tax' },
];

export function PlatformComparison({ option, budget, saved, onSave }: {
  option: DeliveryOption; budget: number; saved: boolean; onSave: () => void;
}) {
  const quotes = demoQuotes[option.id] ?? [];
  const totals = quotes.map(total);
  const lowest = totals.length ? Math.min(...totals) : 0;
  const winners = quotes.filter((quote) => total(quote) === lowest);
  const difference = totals.length > 1 ? Math.max(...totals) - lowest : 0;
  return <article className="comparison-card">
    <header className="comparison-heading">
      <div><p className="section-kicker">SAME MEAL · SAME QUANTITY</p><h3>{option.restaurant}</h3><p>{option.item} · 1 listed menu item / set per platform</p></div>
      <button className={`icon-button ${saved ? 'saved' : ''}`} onClick={onSave} aria-label={`${saved ? 'Unsave' : 'Save'} ${option.restaurant}`} aria-pressed={saved}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
    </header>
    {quotes.length ? <>
      <div className="comparison-table-scroll" role="region" aria-label={`${option.restaurant} platform prices`} tabIndex={0}>
        <table className="comparison-table">
          <caption className="comparison-caption">Illustrative prices and ETAs · no coupons or memberships · tip excluded</caption>
          <thead><tr><th scope="col">Order breakdown</th>{quotes.map((quote) => <th scope="col" key={quote.platform}>{quote.platform}<span className={total(quote) === lowest ? 'lowest-label' : 'platform-label'}>{total(quote) === lowest ? 'Lowest demo total' : 'Comparison price'}</span></th>)}</tr></thead>
          <tbody>{rows.map((row) => <tr key={row.key}><th scope="row">{row.label}</th>{quotes.map((quote) => <td key={quote.platform}>{money(quote[row.key])}</td>)}</tr>)}
            <tr className="comparison-total"><th scope="row">Total before tip</th>{quotes.map((quote) => <td className={total(quote) === lowest ? 'winning-total' : ''} key={quote.platform}>{money(total(quote))}</td>)}</tr>
            <tr><th scope="row">Demo ETA</th>{quotes.map((quote) => <td key={quote.platform}>{quote.eta}</td>)}</tr>
            <tr><th scope="row">Your ${budget.toFixed(2)} budget</th>{quotes.map((quote) => <td key={quote.platform}><span className={total(quote) <= Math.round(budget * 100) ? 'budget-fit' : 'budget-over'}>{total(quote) <= Math.round(budget * 100) ? 'Within budget before tip' : `${money(total(quote) - Math.round(budget * 100))} over budget`}</span></td>)}</tr>
          </tbody>
        </table>
      </div>
      <footer className="comparison-verdict"><strong>{winners.length > 1 ? 'Both platforms have the same demo total.' : `${winners[0].platform} is ${money(difference)} less for this meal.`}</strong><span>Compared only across the sample quotes above. Actual checkout prices may differ.</span></footer>
    </> : <p className="comparison-unavailable">Platform quotes are not available for this meal yet.</p>}
  </article>;
}
