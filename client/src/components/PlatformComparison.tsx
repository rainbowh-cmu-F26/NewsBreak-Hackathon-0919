import { Heart } from 'lucide-react';
import type { DeliveryOption } from '../types';
import './platform-comparison.css';

const money = (cents: number | null | undefined) => cents == null ? 'Not recorded' : `$${(cents / 100).toFixed(2)}`;
export function PlatformComparison({ option, budget, saved, onSave }: {
  option: DeliveryOption; budget: number; saved: boolean; onSave: () => void;
}) {
  const q = option.quote;
  const total = option.total ?? option.price + option.fee;
  return <article className="comparison-card">
    <header className="comparison-heading">
      <div><p className="section-kicker">{option.source}</p><h3>{option.restaurant}</h3><p>{option.item}</p></div>
      <button className={`icon-button ${saved ? 'saved' : ''}`} onClick={onSave} aria-label={`${saved ? 'Unsave' : 'Save'} ${option.restaurant}`} aria-pressed={saved}><Heart size={18} fill={saved ? 'currentColor' : 'none'} /></button>
    </header>
    <div className="comparison-table-scroll"><table className="comparison-table">
      <caption className="comparison-caption">{q?.dataType === 'synthetic' ? 'Database record · simulated pricing and availability' : q ? 'Stored quote · not a live delivery-platform check' : option.source}</caption>
      <thead><tr><th scope="col">Order breakdown</th><th scope="col">{option.provider ?? 'Listed meal'}</th></tr></thead>
      <tbody>
        {q && <>{[['Food subtotal', q.subtotal], ['Delivery fee', q.delivery], ['Service fee', q.service], ['Tax', q.tax], ['Tip', q.tip], ['Discount', q.discount]].map(([label, value]) => <tr key={String(label)}><th scope="row">{label}</th><td>{money(value as number | null)}</td></tr>)}</>}
        <tr className="comparison-total"><th scope="row">{q ? 'Recorded total' : 'Estimated total'}</th><td>{money(Math.round(total * 100))}</td></tr>
        <tr><th scope="row">Delivery estimate</th><td>{option.eta}</td></tr>
        <tr><th scope="row">Your budget</th><td>{total <= budget ? 'Within budget' : `${money(Math.round((total-budget)*100))} over budget`}</td></tr>
      </tbody>
    </table></div>
    {!!option.comparisons?.length && option.comparisons.length > 1 && <div className="comparison-table-scroll"><table className="comparison-table"><caption>Other qualifying stored quotes for the same order</caption><thead><tr><th>Platform</th><th>Recorded total</th></tr></thead><tbody>{option.comparisons.map((comparison, index) => <tr key={`${comparison.platform}-${index}`}><th scope="row">{comparison.platform}</th><td>{money(comparison.total)}</td></tr>)}</tbody></table></div>}
    <footer className="comparison-verdict"><strong>{option.detail}</strong><span>{option.priceNote}</span></footer>
  </article>;
}
