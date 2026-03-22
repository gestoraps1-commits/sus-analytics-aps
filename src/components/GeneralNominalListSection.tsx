import { useMemo, useState } from "react";
import { Search, ExternalLink, UserMinus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import { useQueryClient } from "@tanstack/react-query";
import { ParsedSheet, SearchResult, IndicatorPatient } from "@/types/reference-upload";

type GeneralNominalListSectionProps = {
  sheetsBySection: Record<string, ParsedSheet | null>;
  resultsBySection: Record<string, Record<number, SearchResult>>;
  referenceUploadId: string | null;
  onNavigateToSection: (section: string, patientName: string) => void;
};

type SectionConfigKey = "c2" | "c3" | "c4" | "c5" | "c6" | "c7";

const SECTION_CONFIG: Record<SectionConfigKey, { label: string; route: string }> = {
  c2: { label: "C2", route: "c2-desenvolvimento-infantil" },
  c3: { label: "C3", route: "c3-gestantes-puerperas" },
  c4: { label: "C4", route: "c4-pessoas-diabetes" },
  c5: { label: "C5", route: "c5-pessoas-hipertensao" },
  c6: { label: "C6", route: "c6-pessoa-idosa" },
  c7: { label: "C7", route: "c7-pccu-prevencao" },
};

const UNIDADE_FAMILIA_REGEX = /unidade\s+(de\s+|da\s+)?sa[uú]de\s+(da\s+|de\s+)?fam[ií]lia/gi;

const formatUnidadeName = (unidade?: string): string => {
  if (!unidade) return "";
  return unidade.replace(UNIDADE_FAMILIA_REGEX, "USF").replace(/\s+/g, " ").trim();
};

export const GeneralNominalListSection = ({ sheetsBySection, resultsBySection, referenceUploadId, onNavigateToSection }: GeneralNominalListSectionProps) => {
  const [searchTerm, setSearchTerm] = useState("");
  const [showIncomplete, setShowIncomplete] = useState(false);
  const queryClient = useQueryClient();

  const patients = useMemo(() => {
    const allPatients: any[] = [];
    const seen = new Set<string>();

    Object.entries(sheetsBySection).forEach(([sectionKey, sheet]) => {
      if (!sheet || sheet.mode !== "citizen") return;
      
      const queryKey = ["indicator", sectionKey, sheet.name, referenceUploadId ?? null];
      const indicatorPatients = queryClient.getQueryData<IndicatorPatient[]>(queryKey) || [];

      indicatorPatients.forEach((patient) => {
        const nome = patient.nome || "";
        const cpf = patient.cpf || "";
        const cns = patient.cns || "";
        
        if (!nome && !cpf && !cns) return;

        // Do not aggregate across different sections. Just deduplicate within the same section.
        const id = cpf || cns || nome || String(patient.index);
        const sectionId = `${sectionKey}-${id}`;
        
        if (seen.has(sectionId)) return;
        seen.add(sectionId);

        let suggestedSection = SECTION_CONFIG[sectionKey as SectionConfigKey]?.route || "painel";
        if (patient.nascimento && sectionKey === "c2") {
          const birthDate = new Date(patient.nascimento);
          const ageInYears = (Date.now() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          if (ageInYears >= 7) suggestedSection = "painel"; // If in C2 but > 7 years, maybe not the best fit anymore
        }

        const unidadeFormatada = formatUnidadeName(patient.unidade);

        const displayNome = patient.isIncomplete ? "-" : (nome || "-");
        const displayNascimento = patient.isIncomplete ? "-" : (patient.nascimento || "-");
        const displayUnidade = patient.isIncomplete ? "-" : (unidadeFormatada || "-");
        const displayAcs = patient.isIncomplete ? "-" : (patient.acs || "-");

        allPatients.push({
          id: sectionId, // Ensure unique React key
          nome: displayNome,
          cpf,
          cns,
          nascimento: displayNascimento,
          unidade: displayUnidade,
          acs: displayAcs,
          totalPoints: patient.totalPoints,
          isIncomplete: patient.isIncomplete,
          suggestedSection,
          sectionLabel: SECTION_CONFIG[sectionKey as SectionConfigKey]?.label || sectionKey.toUpperCase(),
          searchString: `${nome} ${cpf} ${cns}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
        });
      });
    });

    return allPatients;
  }, [sheetsBySection, referenceUploadId, queryClient]);

  const incompleteCount = useMemo(() => patients.filter(p => p.isIncomplete).length, [patients]);

  const filteredPatients = useMemo(() => {
    let list = patients.filter(p => showIncomplete ? p.isIncomplete : !p.isIncomplete);
    const term = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (term) {
      list = list.filter(p => p.searchString.includes(term));
    }
    return list;
  }, [patients, searchTerm, showIncomplete]);

  const hasData = Object.values(sheetsBySection).some(s => s !== null && s.rows.length > 0);

  if (!hasData) {
    return (
      <Card className="border-border/80 bg-card/90">
        <CardContent className="py-12 text-center text-muted-foreground">
          Faça upload de uma planilha para visualizar a lista nominal geral consolidada (C2 a C7).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card className="border-border/80 bg-card/95 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="space-y-1">
              <CardTitle className="text-xl font-bold">Lista Nominal Geral</CardTitle>
              <p className="text-xs text-muted-foreground">Consolidado de todas as seções de indicadores (C2 a C7)</p>
            </div>
            <div className="flex flex-col sm:flex-row items-center gap-3">
              {incompleteCount > 0 && (
                <Button
                  type="button"
                  variant={showIncomplete ? "destructive" : "outline"}
                  size="sm"
                  className={cn(
                    "h-10 rounded-2xl px-4 text-xs font-bold transition-all whitespace-nowrap",
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
              <div className="relative w-full sm:w-80">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Buscar por nome, CPF ou CNS..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-[110px]">Seção</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF / CNS</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>ACS</TableHead>
                  <TableHead className="w-[100px] text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.length > 0 ? (
                  filteredPatients.slice(0, 100).map((p) => (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="flex flex-col gap-1.5 min-w-[70px]">
                          <Badge variant="outline" className="w-fit font-bold text-[10px] px-1.5 py-0">
                            {p.sectionLabel}
                          </Badge>
                          {(p.totalPoints !== undefined && p.totalPoints !== null) && (
                            <div className="flex items-center gap-1.5" title="Pontuação no Indicador">
                              <Progress value={p.totalPoints || 0} className="h-1.5 w-10 shadow-sm" />
                              <span className="text-[9px] text-muted-foreground font-medium">
                                {p.totalPoints}/100
                              </span>
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <button
                          onClick={() => onNavigateToSection(p.suggestedSection, p.nome !== "-" ? p.nome : (p.cpf || p.cns || "Incompleto"))}
                          className={cn(
                            "text-left transition-colors",
                            p.isIncomplete ? "text-muted-foreground cursor-default" : "hover:text-primary hover:underline",
                            p.nome === "-" && "font-mono"
                          )}
                          disabled={p.isIncomplete}
                          title={p.isIncomplete ? "Cadastro incompleto" : ""}
                        >
                          {p.nome}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          {p.cpf ? <span className="font-mono text-xs text-foreground">CPF: {p.cpf}</span> : null}
                          {p.cns ? <span className="font-mono text-[10px] opacity-70">CNS: {p.cns}</span> : null}
                          {!p.cpf && !p.cns && <span className="text-xs">-</span>}
                        </div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.nascimento && p.nascimento !== "-" ? new Date(p.nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">{p.unidade || "-"}</TableCell>
                      <TableCell className="text-sm">{p.acs || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-1.5"
                          onClick={() => onNavigateToSection(p.suggestedSection, p.nome !== "-" ? p.nome : (p.cpf || p.cns || "Incompleto"))}
                          disabled={p.isIncomplete}
                          title={p.isIncomplete ? "Navegação indisponível para cadastros incompletos" : ""}
                        >
                          <ExternalLink className="h-3.5 w-3.5" />
                          Ver
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                      Nenhum resultado encontrado.
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
          {filteredPatients.length > 100 && (
            <p className="mt-4 text-center text-xs text-muted-foreground italic">
              Exibindo os primeiros 100 resultados de {filteredPatients.length}. Use a busca para filtrar.
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
};
