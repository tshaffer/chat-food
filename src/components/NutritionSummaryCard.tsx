import { formatNumber } from "../lib/format";

interface NutritionSummaryCardProps {
  label: string;
  value: number;
  unit?: string;
}

export function NutritionSummaryCard({ label, value, unit }: NutritionSummaryCardProps) {
  return (
    <article className="summary-card">
      <span className="eyebrow">{label}</span>
      <strong>{formatNumber(value)}</strong>
      <span className="summary-card__unit">{unit ?? ""}</span>
    </article>
  );
}
