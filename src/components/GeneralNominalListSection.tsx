import { useMemo, useState } from "react";
import { Search, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ParsedSheet, getValue, normalizeDateValue, normalizeDigits } from "@/types/reference-upload";

type GeneralNominalListSectionProps = {
  sheetsBySection: Record<string, ParsedSheet | null>;
  onNavigateToSection: (section: string, patientName: string) => void;
};

const SECTION_CONFIG = {
  c2: { label: "C2", route: "c2-desenvolvimento-infantil" },
  c3: { label: "C3", route: "c3-gestantes-puerperas" },
  c4: { label: "C4", route: "c4-pessoas-diabetes" },
  c5: { label: "C5", route: "c5-pessoas-hipertensao" },
  c6: { label: "C6", route: "c6-pessoa-idosa" },
  c7: { label: "C7", route: "c7-pccu-prevencao" },
};

export const GeneralNominalListSection = ({ sheetsBySection, onNavigateToSection }: GeneralNominalListSectionProps) => {
  const [searchTerm, setSearchTerm] = useState("");

  const patients = useMemo(() => {
    const allPatients: any[] = [];
    const seen = new Set<string>();

    Object.entries(sheetsBySection).forEach(([sectionKey, sheet]) => {
      if (!sheet || sheet.mode !== "citizen") return;

      sheet.rows.forEach((row, index) => {
        const nome = getValue(row, ["NOME", "NO_CIDADAO", "PROFISSIONAL", "NO_PROFISSIONAL"]);
        const cpf = normalizeDigits(getValue(row, ["CPF", "NU_CPF_CIDADAO"]));
        const cns = normalizeDigits(getValue(row, ["CNS", "NU_CNS", "NU_CNS_CIDADAO"]));
        
        if (!nome && !cpf && !cns) return;

        // Skip duplicates across sections to keep the list clean, but track which sections they belong to
        const id = cpf || cns || nome;
        if (seen.has(id)) return;
        seen.add(id);

        const nascimento = normalizeDateValue(getValue(row, ["DN", "DATA NASCIMENTO", "DT_NASCIMENTO", "DT NASCIMENTO"]));
        const unidade = getValue(row, ["UNIDADE", "NO_UNIDADE_SAUDE"]);
        const acs = getValue(row, ["ACS"]);
        
        // Heuristic to suggest section
        let suggestedSection = (SECTION_CONFIG as any)[sectionKey]?.route || "painel";
        if (nascimento && sectionKey === "c2") {
          const birthDate = new Date(nascimento);
          const ageInYears = (new Date().getTime() - birthDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
          if (ageInYears >= 7) suggestedSection = "painel"; // If in C2 but > 7 years, maybe not the best fit anymore
        }

        allPatients.push({
          id,
          nome,
          cpf,
          cns,
          nascimento,
          unidade,
          acs,
          suggestedSection,
          sectionLabel: (SECTION_CONFIG as any)[sectionKey]?.label || sectionKey.toUpperCase(),
          searchString: `${nome} ${cpf} ${cns}`.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase()
        });
      });
    });

    return allPatients;
  }, [sheetsBySection]);

  const filteredPatients = useMemo(() => {
    const term = searchTerm.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().trim();
    if (!term) return patients;
    return patients.filter(p => p.searchString.includes(term));
  }, [patients, searchTerm]);

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
            <div className="relative w-full md:w-80">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome, CPF ou CNS..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border border-border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Seção</TableHead>
                  <TableHead>Nome</TableHead>
                  <TableHead>CPF / CNS</TableHead>
                  <TableHead>Nascimento</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>ACS</TableHead>
                  <TableHead className="text-right">Ação</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredPatients.length > 0 ? (
                  filteredPatients.slice(0, 100).map((p) => (
                    <TableRow key={`${p.sectionLabel}-${p.id}`}>
                      <TableCell>
                        <Badge variant="outline" className="font-bold text-[10px] px-1.5 py-0">
                          {p.sectionLabel}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-medium text-foreground">
                        <button
                          onClick={() => onNavigateToSection(p.suggestedSection, p.nome)}
                          className="text-left hover:text-primary hover:underline transition-colors"
                        >
                          {p.nome}
                        </button>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <div>{p.cpf ? `CPF: ${p.cpf}` : ""}</div>
                        <div>{p.cns ? `CNS: ${p.cns}` : ""}</div>
                      </TableCell>
                      <TableCell className="text-sm">
                        {p.nascimento ? new Date(p.nascimento + "T12:00:00").toLocaleDateString("pt-BR") : "-"}
                      </TableCell>
                      <TableCell className="text-sm truncate max-w-[150px]">{p.unidade || "-"}</TableCell>
                      <TableCell className="text-sm">{p.acs || "-"}</TableCell>
                      <TableCell className="text-right">
                        <Button 
                          variant="ghost" 
                          size="sm" 
                          className="h-8 gap-1.5"
                          onClick={() => onNavigateToSection(p.suggestedSection, p.nome)}
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
