import { useEffect, useMemo, useState } from "react";
import { AlertCircle, Baby, CheckCircle2, ClipboardList, Database, FileSpreadsheet, Minus, Plus, ShieldAlert } from "lucide-react";

import { AnthropometrySummary } from "@/components/AnthropometrySummary";
import { C1Filters, C1FiltersBar } from "@/components/c1/C1FiltersBar";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { LoadingProgressCard } from "@/components/LoadingProgressCard";
import { Progress } from "@/components/ui/progress";
import { isAnthropometryFlag } from "@/lib/anthropometry";
import { useIndicatorData, INDICATOR_CONFIGS } from "@/hooks/useIndicatorData";
import { cn } from "@/lib/utils";
import { IndicatorPatient, ParsedSheet, SearchResult } from "@/types/reference-upload";

type C1DevelopmentSectionProps = {
  selectedSheet: ParsedSheet | null;
  results: Record<number, SearchResult>;
  referenceUploadId: string | null;
  isPreparingData?: boolean;
  initialSearch?: string;
};

const classificationLabel: Record<IndicatorPatient["classification"], string> = {
  regular: "Regular",
  suficiente: "Suficiente",
  bom: "Bom",
  otimo: "Ótimo",
};

const statusConfig = {
  done: {
    label: "Realizado",
    badgeVariant: "default" as const,
    cardClassName: "border-primary/20 bg-primary/5",
    icon: CheckCircle2,
  },
  tracking: {
    label: "Em acompanhamento",
    badgeVariant: "secondary" as const,
    cardClassName: "border-border bg-secondary/40",
    icon: ClipboardList,
  },
  attention: {
    label: "Pendente",
    badgeVariant: "outline" as const,
    cardClassName: "border-destructive/30 bg-destructive/5",
    icon: AlertCircle,
  },
};

const initialFilters: C1Filters = {
  unit: "all",
  status: "all",
  procedure: "all",
  classification: "all",
  search: "",
  showIncomplete: false,
};

const formatDate = (value: string) => {
  if (!value) return "-";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("pt-BR");
};

const normalizeSearchText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

export const C1DevelopmentSection = ({ 
  selectedSheet, 
  results, 
  referenceUploadId, 
  isPreparingData = false,
  initialSearch 
}: C1DevelopmentSectionProps) => {
  const { patients: indicatorPatients, isLoading, error } = useIndicatorData({
    config: INDICATOR_CONFIGS.c2,
    selectedSheet,
    results,
    referenceUploadId,
  });

  const [filters, setFilters] = useState<C1Filters>(initialFilters);
  const [expandedPatients, setExpandedPatients] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (initialSearch) {
      setFilters(prev => ({ ...prev, search: initialSearch }));
    }
  }, [initialSearch]);


  const unitOptions = useMemo(
    () =>
      Array.from(new Set(indicatorPatients.map((patient) => patient.unidade).filter(Boolean))).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [indicatorPatients],
  );

  const procedureOptions = useMemo(
    () =>
      Array.from(new Set(indicatorPatients.flatMap((patient) => patient.flags.map((flag) => `${flag.key} · ${flag.title}`)))).sort((a, b) =>
        a.localeCompare(b, "pt-BR"),
      ),
    [indicatorPatients],
  );
  
  const incompleteCount = useMemo(
    () => indicatorPatients.filter((p) => p.isIncomplete).length,
    [indicatorPatients]
  );

  const filteredPatients = useMemo(() => {
    const query = normalizeSearchText(filters.search);

    return indicatorPatients.filter((patient) => {
      const searchMatches =
        !query ||
        normalizeSearchText(patient.nome).includes(query) ||
        patient.cpf.includes(query) ||
        patient.cns.includes(query);

      const unitMatches = filters.unit === "all" || patient.unidade === filters.unit;
      const procedureMatches =
        filters.procedure === "all" || patient.flags.some((flag) => `${flag.key} · ${flag.title}` === filters.procedure);
      const classificationMatches = filters.classification === "all" || patient.classification === filters.classification;

      const statusMatches =
        filters.status === "all" ||
        (filters.status === "eligible" && patient.totalPoints >= 0) ||
        (filters.status === "pending" && patient.pendingFlags > 0) ||
        (filters.status === "tracking" && patient.trackingFlags > 0) ||
        (filters.status === "done" && patient.pendingFlags === 0 && patient.trackingFlags === 0) ||
        (filters.status === "lost" && (patient.pendingFlags >= 3 || patient.totalPoints <= 20));

      const incompleteMatches = filters.showIncomplete ? patient.isIncomplete : !patient.isIncomplete;

      return searchMatches && unitMatches && procedureMatches && classificationMatches && statusMatches && incompleteMatches;
    });
  }, [filters, indicatorPatients]);

  const dashboard = useMemo(() => {
    const total = filteredPatients.length;
    const completed = filteredPatients.filter((patient) => patient.pendingFlags === 0 && patient.trackingFlags === 0).length;
    const withPending = filteredPatients.filter((patient) => patient.pendingFlags > 0).length;
    const averageScore = total ? Math.round(filteredPatients.reduce((sum, patient) => sum + patient.totalPoints, 0) / total) : 0;

    return { total, completed, withPending, averageScore };
  }, [filteredPatients]);

  const INITIAL_LIMIT = 50;
  const LOAD_MORE_STEP = 50;
  const [displayLimit, setDisplayLimit] = useState(INITIAL_LIMIT);

  const hasActiveFilters = useMemo(
    () =>
      filters.search !== "" ||
      filters.unit !== "all" ||
      filters.status !== "all" ||
      filters.procedure !== "all" ||
      filters.classification !== "all",
    [filters],
  );

  const visiblePatients = useMemo(() => {
    if (hasActiveFilters) return filteredPatients;
    return filteredPatients.slice(0, displayLimit);
  }, [filteredPatients, displayLimit, hasActiveFilters]);

  const handleFilterChange = <K extends keyof C1Filters>(key: K, value: C1Filters[K]) => {
    setFilters((current) => ({ ...current, [key]: value }));
    setDisplayLimit(INITIAL_LIMIT);
  };

  if (!selectedSheet) {
    if (isPreparingData) {
      return (
        <LoadingProgressCard
          title="Preparando dados do indicador"
          description="Os dados enviados no upload já estão sendo cruzados automaticamente. Abra esta seção e acompanhe o progresso."
          value={38}
        />
      );
    }

    return (
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Faça upload de uma planilha primeiro para gerar a análise do indicador infantil.
        </CardContent>
      </Card>
    );
  }

  if (selectedSheet.mode !== "citizen") {
    if (isPreparingData) {
      return (
        <LoadingProgressCard
          title="Organizando a aba correta"
          description="Priorizando automaticamente a aba de cidadãos para montar o indicador infantil sem intervenção extra no upload."
          value={52}
        />
      );
    }

    return (
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          A seção C2 usa apenas abas de cidadãos com nome, CPF/CNS e data de nascimento; a aba atual é de profissionais.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="space-y-5 p-5 md:p-6">
          <div className="grid gap-4 lg:grid-cols-4">
            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Aba de referência</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <FileSpreadsheet className="h-4 w-4 text-accent" />
                {selectedSheet.name}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pacientes avaliados</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <Database className="h-4 w-4 text-accent" />
                {dashboard.total}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Com pendências</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <ShieldAlert className="h-4 w-4 text-accent" />
                {dashboard.withPending}
              </p>
            </div>
            <div className="rounded-3xl border border-border bg-background/70 p-4">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pontuação média</p>
              <p className="mt-2 flex items-center gap-2 text-base font-semibold text-foreground">
                <Baby className="h-4 w-4 text-accent" />
                {dashboard.averageScore} / 100
              </p>
            </div>
          </div>

          {isLoading ? (
            <LoadingProgressCard
              title="Calculando indicador"
              description="Buscando consultas, antropometria, visitas domiciliares e vacinação na base remota."
              value={isPreparingData ? 72 : 88}
            />
          ) : null}

          {error ? (
            <Alert variant="destructive">
              <AlertTitle>Falha no cálculo</AlertTitle>
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
        </CardContent>
      </Card>

      <C1FiltersBar
        filters={filters}
        unitOptions={unitOptions}
        procedureOptions={procedureOptions}
        classificationOptions={Object.entries(classificationLabel).map(([value, label]) => ({ value, label }))}
        onChange={handleFilterChange}
        incompleteCount={incompleteCount}
      />

      {filteredPatients.length > 0 ? (
        <div className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-3xl border border-border bg-background/60 px-4 py-3 text-sm text-muted-foreground">
            <span>
              {hasActiveFilters
                ? `${filteredPatients.length} paciente(s) encontrados após aplicar os filtros.`
                : `Exibindo ${visiblePatients.length} de ${filteredPatients.length} paciente(s). Use os filtros para refinar.`}
            </span>
            <span>Sem pendências: {dashboard.completed} · Perdidos: {filteredPatients.filter((patient) => patient.pendingFlags >= 3 || patient.totalPoints <= 20).length}</span>
          </div>

          <div className="space-y-5">
            {visiblePatients.map((patient) => {
              const patientKey = `${patient.index}-${patient.cpf || patient.cns || patient.nome}`;
              const isExpanded = expandedPatients[patientKey] ?? false;
              const pendingFlags = patient.flags.filter((flag) => flag.status === "attention");
              const visibleFlags =
                filters.procedure === "all"
                  ? patient.flags
                  : patient.flags.filter((flag) => `${flag.key} · ${flag.title}` === filters.procedure);

              return (
                <Card key={patientKey} className="overflow-hidden border-border/80 bg-card/95 shadow-sm">
                  <CardContent className="space-y-6 p-5 md:p-6">
                    <div className={cn("grid gap-5", isExpanded ? "xl:grid-cols-[1.3fr_0.7fr]" : "xl:grid-cols-1")}>
                      <div className="space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-xl font-black tracking-tight text-foreground">{patient.nome}</h3>
                              <Badge variant="secondary">{classificationLabel[patient.classification]}</Badge>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
                              <span>CPF: {patient.cpf || "-"}</span>
                              <span>CNS: {patient.cns || "-"}</span>
                              <span>Nascimento: {formatDate(patient.nascimento)}</span>
                              <span>Sexo: {patient.sexo || "-"}</span>
                              <span>Idade: {patient.idadeEmMeses} meses</span>
                            </div>
                          </div>

                          <div className="flex items-start gap-3">
                            <div className="min-w-[220px] rounded-3xl border border-border bg-background/70 p-4">
                              <div className="flex items-center justify-between text-sm text-muted-foreground">
                                <span>Pontuação</span>
                                <span className="font-semibold text-foreground">{patient.totalPoints}/100</span>
                              </div>
                              <Progress value={patient.totalPoints} className="mt-3 h-3" />
                              <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                                <span>{patient.completedFlags} realizados</span>
                                <span>•</span>
                                <span>{patient.trackingFlags} em acompanhamento</span>
                                <span>•</span>
                                <span>{patient.pendingFlags} pendentes</span>
                              </div>
                              {isExpanded ? <AnthropometrySummary records={patient.anthropometryRecords} /> : null}
                            </div>

                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              className="mt-1 h-11 w-11 rounded-full"
                              aria-expanded={isExpanded}
                              aria-label={isExpanded ? `Ocultar flags de ${patient.nome}` : `Mostrar flags de ${patient.nome}`}
                              onClick={() => setExpandedPatients((current) => ({ ...current, [patientKey]: !isExpanded }))}
                            >
                              {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                          <div className="rounded-3xl border border-border bg-background/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Unidade</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{patient.unidade || "Não identificada"}</p>
                          </div>
                          <div className="rounded-3xl border border-border bg-background/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Equipe</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{patient.equipe || "Sem vínculo informado"}</p>
                          </div>
                        </div>

                        {pendingFlags.length > 0 ? (
                          <div className="rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Pendências prioritárias</p>
                            <div className="mt-3 flex flex-wrap gap-2">
                              {pendingFlags.map((flag) => (
                                <Badge key={flag.key} variant="outline" className="border-destructive/30 bg-background">
                                  {flag.key} · {flag.title}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        ) : (
                          <div className="rounded-3xl border border-primary/20 bg-primary/5 p-4 text-sm text-foreground">
                            Este paciente não possui pendências vencidas no indicador no momento.
                          </div>
                        )}
                      </div>

                      {isExpanded ? (
                        <div className="rounded-[1.75rem] border border-border bg-background/70 p-4">
                          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Flags do indicador</p>
                          <div className="mt-4 space-y-3">
                            {visibleFlags.map((flag) => {
                              const config = statusConfig[flag.status];
                              const Icon = config.icon;

                              return (
                                <div key={flag.key} className={cn("rounded-3xl border p-4", config.cardClassName)}>
                                  <div className="flex flex-wrap items-start justify-between gap-3">
                                    <div>
                                      <div className="flex items-center gap-2">
                                        <Icon className="h-4 w-4 text-accent" />
                                        <p className="text-sm font-semibold text-foreground">
                                          {flag.key} · {flag.title}
                                        </p>
                                      </div>
                                      <p className="mt-2 text-xs text-muted-foreground">{flag.metric}</p>
                                    </div>
                                    <Badge variant={config.badgeVariant}>{config.label}</Badge>
                                  </div>
                                  <p className="mt-3 text-sm text-foreground">{flag.summary}</p>
                                  {flag.deadline ? (
                                    <div className="mt-3 rounded-2xl border border-border/70 bg-background/80 p-3">
                                      <p className="text-xs leading-5 text-foreground">
                                        Data limite para registro: {formatDate(flag.deadline.date)}
                                      </p>
                                    </div>
                                  ) : null}
                                  {flag.events?.length && !isAnthropometryFlag(flag) ? (
                                    <div className="mt-3 rounded-2xl border border-border/70 bg-background/80 p-3">
                                      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-muted-foreground">Dados coletados</p>
                                      <ul className="mt-2 max-h-40 space-y-1 overflow-y-auto text-xs leading-5 text-foreground">
                                        {flag.events
                                          .filter((event) => event.date && event.professional && event.professional.trim().toLowerCase() !== "não informado")
                                          .map((event, eventIndex) => (
                                            <li key={`${flag.key}-${event.date}-${event.professional}-${eventIndex}`}>
                                              {formatDate(event.date)} - {event.professional}
                                            </li>
                                          ))}
                                      </ul>
                                    </div>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {!hasActiveFilters && displayLimit < filteredPatients.length && (
            <div className="flex justify-center pt-2">
              <Button
                type="button"
                variant="outline"
                className="rounded-full px-6"
                onClick={() => setDisplayLimit((prev) => prev + LOAD_MORE_STEP)}
              >
                Carregar mais {Math.min(LOAD_MORE_STEP, filteredPatients.length - displayLimit)} pacientes
              </Button>
            </div>
          )}
        </div>
      ) : !isLoading && !error ? (
        <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
          <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
            Nenhum paciente corresponde aos filtros atuais ou foi encontrado para calcular as flags do indicador.
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
};
