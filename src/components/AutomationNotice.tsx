import type { AutomationCoverage } from "../data/automationCoverage";

const labels = { automatic: "Automatic", partial: "Partial automation", manual: "Manual effects" };
export function AutomationBadge({ coverage }: { coverage: AutomationCoverage }) {
  return <span className={`automation-badge automation-${coverage.level}`}>{labels[coverage.level]}</span>;
}
export function AutomationDetails({ coverage }: { coverage: AutomationCoverage }) {
  return <div className="automation-details"><p><strong>App handles:</strong> {coverage.app}</p><p><strong>At the table:</strong> {coverage.table}</p></div>;
}
export function AutomationLegend() {
  return <p className="automation-legend"><strong>Automation guide:</strong> Automatic applies a benefit to your sheet. Partial automation handles only the parts listed. Manual effects need table resolution; counters and casting records can still update. Open an ability for details.</p>;
}
