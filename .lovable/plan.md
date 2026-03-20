

## Plano: Dashboard BI para Auditoria com exportação PDF

### O que será construído

Adicionar uma aba "Dashboard" na seção de Auditoria que exibe gráficos e KPIs analíticos sobre os dados já carregados, com opção de exportar o dashboard completo em PDF. A aba de tabela existente permanece intacta.

### Estrutura

O componente `AuditoriaSection` ganhará duas abas via `Tabs`:
- **Tabela** (atual) — comportamento existente sem alterações
- **Dashboard** — novo painel BI com KPIs e gráficos

### KPIs do Dashboard (linha superior)

1. Total de procedimentos
2. Procedimentos por dia (média)
3. Total de profissionais únicos
4. Total de unidades únicas
5. Indicador com mais registros
6. Cobertura (% de indicadores com registro)

### Gráficos (usando Recharts, já instalado no projeto)

1. **Procedimentos por indicador** — BarChart horizontal (quantidade por C1-C7)
2. **Procedimentos por unidade** — BarChart horizontal (top 10 unidades)
3. **Volume diário** — LineChart com eixo X = data, Y = quantidade
4. **Distribuição por tipo (source)** — PieChart (Visita, Atendimento, etc.)
5. **Top 15 profissionais** — BarChart horizontal por volume
6. **Heatmap indicador x unidade** — tabela com células coloridas por intensidade

### Exportação PDF do Dashboard

- Novo botão "PDF Dashboard" ao lado dos botões Excel/PDF existentes
- Usa `jsPDF` + `jspdf-autotable` (já instalados) para gerar:
  - Cabeçalho com título e data
  - Tabela de KPIs
  - Tabelas resumo (por indicador, por unidade, por profissional)
  - Nota: gráficos não são renderizados no PDF (limitação de jsPDF), mas os dados são representados em tabelas formatadas

### Arquivos alterados

**`src/components/AuditoriaSection.tsx`**
- Importar `Tabs, TabsList, TabsTrigger, TabsContent`
- Envolver o conteúdo atual (filtros + sumário + tabela) na aba "Tabela"
- Adicionar aba "Dashboard" que renderiza `<AuditDashboard records={filteredRecords} />`
- Adicionar botão "PDF Dashboard" junto aos botões de exportação existentes

**`src/components/audit/AuditDashboard.tsx`** (novo)
- Componente que recebe `records: AuditRecord[]` e renderiza:
  - Linha de KPI cards (mesmo estilo do `IndicatorTabDetail`)
  - Gráficos Recharts (BarChart, LineChart, PieChart)
  - Todos computados via `useMemo` sobre os records filtrados

**`src/components/audit/AuditDashboardPdf.tsx`** (novo)
- Função `exportAuditDashboardPdf(records)` que gera PDF com:
  - KPIs em tabela
  - Resumo por indicador, unidade, profissional em tabelas autotable
  - Orientação landscape

### Detalhes técnicos

- Recharts já está instalado e usado em `IndicatorTabDetail`
- `jsPDF` e `jspdf-autotable` já estão instalados
- Os dados vêm do `filteredRecords` já computado — sem chamadas extras ao backend
- O dashboard só aparece quando há dados carregados (`result !== null`)
- PieChart usa `@recharts` com `Pie`, `Cell`, `Tooltip`, `Legend`

