import type { PlanResponse } from '../types';

export function AgentFilters({ plan }: { plan: PlanResponse }) {
  if (!plan.agent) return null;
  return <section className="agent-filters" aria-label="Interpreted search preferences" aria-live="polite">
    <div className="agent-filters-heading"><strong>What I’m looking for</strong><span>{plan.agent.mode === 'model' ? 'AI interpretation' : plan.agent.mode === 'unavailable' ? 'AI unavailable' : 'Local interpretation'} · {plan.dataSource === 'verified-demo-data' ? 'Demo catalog' : 'Provider catalog'}</span></div>
    <ul>{plan.agent.appliedFilters.map((filter) => <li key={filter}>{filter}</li>)}</ul>
    {plan.agent.clarification && <p className="agent-question">{plan.agent.clarification}</p>}
    {plan.agent.warnings.map((warning) => <p className="agent-warning" key={warning}>{warning}</p>)}
    <p className="agent-hint">Refine in chat: “no noodles”, “make it cheaper”, or “any cuisine”.</p>
  </section>;
}
