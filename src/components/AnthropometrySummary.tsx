import { formatHeightValue, formatWeightValue } from "@/lib/anthropometry";
import type { AnthropometryRecord } from "@/types/reference-upload";

const formatDate = (value: string) => {
  if (!value) return "-";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("pt-BR");
};

type AnthropometrySummaryProps = {
  records?: AnthropometryRecord[];
};

export const AnthropometrySummary = ({ records = [] }: AnthropometrySummaryProps) => (
  <div className="mt-4 border-t border-border/70 pt-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Antropometria recente</p>
    {records.length > 0 ? (
      <div className="mt-2 space-y-2">
        {records.slice(0, 2).map((record, index) => (
          <div key={`${record.date}-${record.weight}-${record.height}-${index}`} className="rounded-2xl border border-border/70 bg-card/80 px-3 py-2">
            <p className="text-xs font-medium text-foreground">{formatDate(record.date)}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              Peso: <span className="font-medium text-foreground">{formatWeightValue(record.weight)}</span>
              <span className="px-1 text-muted-foreground">•</span>
              Altura: <span className="font-medium text-foreground">{formatHeightValue(record.height)}</span>
            </p>
          </div>
        ))}
      </div>
    ) : (
      <p className="mt-2 text-xs text-muted-foreground">Sem registros antropométricos recentes.</p>
    )}
  </div>
);
