import { AlertCircle, Search, UserMinus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export type C1StatusFilter = "all" | "eligible" | "pending" | "tracking" | "done" | "lost";

export type C1Filters = {
  unit: string;
  status: C1StatusFilter;
  procedure: string;
  classification: string;
  search: string;
  showIncomplete: boolean;
};

type C1FiltersBarProps = {
  filters: C1Filters;
  unitOptions: string[];
  procedureOptions: string[];
  classificationOptions: Array<{ value: string; label: string }>;
  onChange: <K extends keyof C1Filters>(key: K, value: C1Filters[K]) => void;
  incompleteCount?: number;
};

const selectClassName =
  "h-12 w-full rounded-2xl border border-border bg-background px-4 text-sm text-foreground outline-none transition focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2";

export const C1FiltersBar = ({ filters, unitOptions, procedureOptions, classificationOptions, onChange, incompleteCount }: C1FiltersBarProps) => {
  return (
    <div className="space-y-4 rounded-[1.75rem] border border-border bg-card/95 p-5 shadow-sm md:p-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Filtros essenciais</p>
          <h3 className="mt-2 text-xl font-black tracking-tight text-foreground">Recortes operacionais antes da lista nominal</h3>
        </div>
        <div className="flex flex-col items-start gap-4 lg:flex-row lg:items-center">
          <div className="max-w-md text-sm text-muted-foreground">
            Busca por nome, CPF ou CNS e filtros para pendências, elegibilidade e perdas.
          </div>
          {!!incompleteCount && incompleteCount > 0 && (
            <Button
              type="button"
              variant={filters.showIncomplete ? "destructive" : "outline"}
              size="sm"
              className={cn(
                "h-10 rounded-2xl px-4 text-xs font-bold transition-all",
                filters.showIncomplete ? "shadow-md shadow-destructive/20" : "hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
              )}
              onClick={() => onChange("showIncomplete", !filters.showIncomplete)}
            >
              <UserMinus className="mr-2 h-4 w-4" />
              {filters.showIncomplete ? "Ocultar Incompletos" : "Visualizar Cadastrados Incompletos"}
              <Badge 
                variant={filters.showIncomplete ? "secondary" : "destructive"} 
                className="ml-2 rounded-lg px-1.5 py-0 text-[10px]"
              >
                {incompleteCount}
              </Badge>
            </Button>
          )}
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.4fr_repeat(4,minmax(0,1fr))]">
        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Motor de busca</span>
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={filters.search}
              onChange={(event) => onChange("search", event.target.value)}
              placeholder="Nome, CPF ou CNS"
              className="h-12 rounded-2xl border-border bg-background pl-11"
            />
          </div>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Unidade</span>
          <select value={filters.unit} onChange={(event) => onChange("unit", event.target.value)} className={selectClassName}>
            <option value="all">Todas as unidades</option>
            {unitOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Procedimentos</span>
          <select value={filters.procedure} onChange={(event) => onChange("procedure", event.target.value)} className={selectClassName}>
            <option value="all">Todos os procedimentos</option>
            {procedureOptions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Situação</span>
          <select value={filters.status} onChange={(event) => onChange("status", event.target.value as C1StatusFilter)} className={selectClassName}>
            <option value="all">Todos</option>
            <option value="eligible">Elegíveis</option>
            <option value="pending">Pendentes</option>
            <option value="tracking">Em acompanhamento</option>
            <option value="done">Sem pendências</option>
            <option value="lost">Perdidos</option>
          </select>
        </label>

        <label className="space-y-2">
          <span className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Classificação</span>
          <select
            value={filters.classification}
            onChange={(event) => onChange("classification", event.target.value)}
            className={selectClassName}
          >
            <option value="all">Todas</option>
            {classificationOptions.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
};
