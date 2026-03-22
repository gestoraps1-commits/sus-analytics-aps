import { useMemo, useState } from "react";
import { Minus, Plus, UserMinus } from "lucide-react";

import { AnthropometrySummary } from "@/components/AnthropometrySummary";
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

type C2NominalListSectionProps = {
  selectedSheet: ParsedSheet | null;
  results: Record<number, SearchResult>;
  referenceUploadId: string | null;
  isPreparingData?: boolean;
};

const classificationLabel: Record<IndicatorPatient["classification"], string> = {
  regular: "Regular",
  suficiente: "Suficiente",
  bom: "Bom",
  otimo: "Ótimo",
};

const statusLabel: Record<IndicatorPatient["flags"][number]["status"], string> = {
  done: "Realizado",
  tracking: "Em acompanhamento",
  attention: "Pendente",
};

const formatDate = (value: string) => {
  if (!value) return "-";
  return new Date(`${value}T00:00:00.000Z`).toLocaleDateString("pt-BR");
};


const isNamedProfessional = (value: string) => {
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toUpperCase();

  return Boolean(normalized) && normalized !== "NAO INFORMADO";
};

export const C2NominalListSection = ({ selectedSheet, results, referenceUploadId, isPreparingData = false }: C2NominalListSectionProps) => {
  const { patients: indicatorPatients, isLoading, error } = useIndicatorData({
    config: INDICATOR_CONFIGS.c2,
    selectedSheet,
    results,
    referenceUploadId,
  });

  const [expandedPatientKey, setExpandedPatientKey] = useState<string | null>(null);
  const [showIncomplete, setShowIncomplete] = useState(false);

  const incompleteCount = useMemo(
    () => indicatorPatients.filter((p) => p.isIncomplete).length,
    [indicatorPatients]
  );

  const filteredPatients = useMemo(() => {
    return indicatorPatients.filter((patient) => {
      return showIncomplete ? patient.isIncomplete : !patient.isIncomplete;
    });
  }, [indicatorPatients, showIncomplete]);

  if (!selectedSheet) {
    if (isPreparingData) {
      return (
        <LoadingProgressCard
          title="Preparando lista nominal"
          description="A base do upload já está sendo processada em segundo plano para abrir a lista nominal sem nova intervenção."
          value={38}
        />
      );
    }

    return (
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          Faça upload de uma planilha primeiro para montar a lista nominal.
        </CardContent>
      </Card>
    );
  }

  if (selectedSheet.mode !== "citizen") {
    if (isPreparingData) {
      return (
        <LoadingProgressCard
          title="Selecionando dados de cidadãos"
          description="A plataforma está priorizando automaticamente a aba compatível para preencher a lista nominal."
          value={52}
        />
      );
    }

    return (
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
          A lista nominal usa apenas abas de cidadãos com nome, CPF/CNS e data de nascimento.
        </CardContent>
      </Card>
    );
  }
  const EmptyCard = () => (
    <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
      <CardContent className="px-6 py-12 text-center text-sm text-muted-foreground">
        {showIncomplete
          ? "Nenhum cadastro incompleto encontrado nesta aba."
          : "Nenhum paciente com cadastro completo encontrado nesta aba."}
      </CardContent>
    </Card>
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <h2 className="text-lg font-bold tracking-tight text-foreground">Lista Nominal Detalhada</h2>
          <p className="text-sm text-muted-foreground">Visualização completa de todos os critérios do indicador para cada paciente.</p>
        </div>

        {incompleteCount > 0 && (
          <Button
            type="button"
            variant={showIncomplete ? "destructive" : "outline"}
            size="sm"
            className={cn(
              "h-10 rounded-2xl px-4 text-xs font-bold transition-all",
              showIncomplete ? "shadow-md shadow-destructive/20" : "hover:bg-destructive/5 hover:text-destructive hover:border-destructive/30"
            )}
            onClick={() => setShowIncomplete(!showIncomplete)}
          >
            <UserMinus className="mr-2 h-4 w-4" />
            {showIncomplete ? "Ocultar Incompletos" : "Visualizar Cadastrados Incompletos"}
            <Badge
              variant={showIncomplete ? "secondary" : "destructive"}
              className="ml-2 rounded-lg px-1.5 py-0 text-[10px]"
            >
              {incompleteCount}
            </Badge>
          </Button>
        )}
      </div>

      {isLoading ? (
        <LoadingProgressCard
          title="Carregando lista nominal"
          description="Preparando os pacientes e consolidando os dados do indicador em segundo plano."
          value={isPreparingData ? 72 : 88}
        />
      ) : null}

      {error ? (
        <Alert variant="destructive">
          <AlertTitle>Falha ao carregar</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {filteredPatients.length > 0 ? (
        <div className="space-y-4">
          {filteredPatients.map((patient) => {
            const patientKey = `${patient.index}-${patient.cpf || patient.cns || patient.nome}`;
            const isExpanded = expandedPatientKey === patientKey;

            return (
              <Card key={patientKey} className="overflow-hidden border-border/80 bg-card/95 shadow-sm">
                <CardContent className="space-y-5 p-5 md:p-6">
                  <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0 flex-1 space-y-5">
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
                              aria-label={isExpanded ? `Ocultar dados relacionados de ${patient.nome}` : `Mostrar dados relacionados de ${patient.nome}`}
                              onClick={() => setExpandedPatientKey((current) => (current === patientKey ? null : patientKey))}
                            >
                              {isExpanded ? <Minus className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                            </Button>
                          </div>
                        </div>

                        <div className="grid gap-3 md:grid-cols-3">
                          <div className="rounded-3xl border border-border bg-background/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Unidade</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{patient.unidade || "Não identificada"}</p>
                          </div>
                          <div className="rounded-3xl border border-border bg-background/70 p-4">
                            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Equipe</p>
                            <p className="mt-2 text-sm font-medium text-foreground">{patient.equipe || "Sem vínculo informado"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {isExpanded ? (
                      <div className="space-y-4 border-t border-border pt-5">
                        <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Dados relacionados</p>
                        <div className="grid gap-3 xl:grid-cols-2">
                          {patient.flags.map((flag) => {
                            const visibleEvents = isAnthropometryFlag(flag)
                              ? []
                              : (flag.events ?? []).filter((event) => event.date && isNamedProfessional(event.professional));

                            return (
                              <div key={`${patientKey}-${flag.key}`} className="rounded-3xl border border-border bg-background/70 p-4">
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div>
                                    <p className="text-sm font-semibold text-foreground">
                                      {flag.key} · {flag.title}
                                    </p>
                                    <p className="mt-1 text-xs text-muted-foreground">{flag.metric}</p>
                                  </div>
                                  <Badge variant={flag.status === "attention" ? "outline" : flag.status === "tracking" ? "secondary" : "default"}>
                                    {statusLabel[flag.status]}
                                  </Badge>
                                </div>

                                <p className="mt-3 text-sm text-foreground">{flag.summary}</p>

                                {visibleEvents.length > 0 ? (
                                  <ul className="mt-3 space-y-1 rounded-2xl border border-border/70 bg-card/80 p-3 text-xs leading-5 text-foreground">
                                    {visibleEvents.map((event, eventIndex) => (
                                      <li key={`${flag.key}-${event.date}-${event.professional}-${eventIndex}`}>
                                        {formatDate(event.date)} - {event.professional}
                                      </li>
                                    ))}
                                  </ul>
                                ) : null}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : null}
                </CardContent>
              </Card>
            );
          })}
        </div>
      ) : !isLoading && !error ? (
        <EmptyCard />
      ) : null}
    </div>
  );
};
