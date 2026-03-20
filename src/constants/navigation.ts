import { Baby, BarChart3, Building2, ClipboardList, FileDown, Heart, Link2, Settings, ShieldCheck, Upload, UserRound, UserCog, LucideIcon } from "lucide-react";

export type SectionKey = 
  | "conexao" 
  | "upload" 
  | "painel" 
  | "c2-desenvolvimento-infantil" 
  | "c3-gestantes-puerperas" 
  | "c4-pessoas-diabetes" 
  | "c5-pessoas-hipertensao" 
  | "c6-pessoa-idosa" 
  | "c7-pccu-prevencao" 
  | "lista-geral" 
  | "exportacao" 
  | "auditoria" 
  | "cadastro-municipal" 
  | "perfis" 
  | "gestao-usuarios";

export type MenuItem = {
  label: string;
  icon: LucideIcon;
  section: SectionKey;
  adminOnly?: boolean;
};

export type SectionHeaderContent = {
  eyebrow: string;
  title: string;
  description: string;
};

export const menuItems: MenuItem[] = [
  { label: "Conexão", icon: Link2, section: "conexao" },
  { label: "Upload", icon: Upload, section: "upload" },
  { label: "Lista Geral", icon: UserRound, section: "lista-geral" },
  { label: "Painel de Indicadores", icon: BarChart3, section: "painel" },
  { label: "C2 - Desenv. Infantil", icon: Baby, section: "c2-desenvolvimento-infantil" },
  { label: "C3 - Gestantes e Puérperas", icon: Heart, section: "c3-gestantes-puerperas" },
  { label: "C4 - Pessoa com Diabetes", icon: ShieldCheck, section: "c4-pessoas-diabetes" },
  { label: "C5 - Pessoa com Hipertensão", icon: ShieldCheck, section: "c5-pessoas-hipertensao" },
  { label: "C6 - Pessoa Idosa", icon: UserRound, section: "c6-pessoa-idosa" },
  { label: "C7 - PCCU e Prevenção", icon: ShieldCheck, section: "c7-pccu-prevencao" },
  { label: "Exportação de Dados", icon: FileDown, section: "exportacao" },
  { label: "Auditoria", icon: ClipboardList, section: "auditoria" },
  { label: "Cadastro Municipal", icon: Building2, section: "cadastro-municipal" },
  { label: "Perfis", icon: Settings, section: "perfis" },
  { label: "Gestão de Usuários", icon: UserCog, section: "gestao-usuarios" },
];

export const sectionTitles: Record<SectionKey, SectionHeaderContent> = {
  conexao: {
    eyebrow: "Conexão",
    title: "Conexão com a base de apoio assistencial",
    description: "Valide o acesso à base utilizada pela aplicação para apoiar o cruzamento nominal, a conferência dos registros e o processamento dos indicadores.",
  },
  painel: {
    eyebrow: "Visão Geral",
    title: "Painel de Indicadores",
    description: "Visão consolidada dos indicadores C2 a C7, com cards de resumo, filtros globais e gráfico comparativo de desempenho por programa.",
  },
  upload: {
    eyebrow: "Upload",
    title: "Importação da planilha de referência",
    description: "Envie a planilha nominal para identificar cidadãos, localizar vínculos na base e preparar os dados que alimentam a leitura dos indicadores.",
  },
  "c2-desenvolvimento-infantil": {
    eyebrow: "Boas Práticas da APS",
    title: "C2 - Desenvolvimento infantil",
    description: "Indicador voltado ao acompanhamento do desenvolvimento infantil na Atenção Primária, com ênfase no monitoramento oportuno de consultas, vacinação, visitas e registros essenciais previstos na portaria.",
  },
  "c3-gestantes-puerperas": {
    eyebrow: "Boas Práticas da APS",
    title: "C3 - Gestantes e puérperas",
    description: "Indicador relacionado ao cuidado da gestação e do puerpério, com foco no acompanhamento do pré-natal, exames, vacinação, visitas e demais registros assistenciais previstos na portaria.",
  },
  "c4-pessoas-diabetes": {
    eyebrow: "Boas Práticas da APS",
    title: "C4 - Cuidado da Pessoa com Diabetes",
    description: "Indicador direcionado ao cuidado longitudinal da pessoa com diabetes, destacando consultas, avaliação clínica, exames, visitas e demais registros obrigatórios definidos na portaria.",
  },
  "c5-pessoas-hipertensao": {
    eyebrow: "Boas Práticas da APS",
    title: "C5 - Cuidado da Pessoa com Hipertensão",
    description: "Indicador direcionado ao cuidado longitudinal da pessoa com hipertensão, com foco em consulta, aferição de pressão, antropometria e visitas domiciliares previstas na nota metodológica.",
  },
  "c6-pessoa-idosa": {
    eyebrow: "Boas Práticas da APS",
    title: "C6 - Cuidado da Pessoa Idosa",
    description: "Indicador direcionado ao cuidado longitudinal da pessoa idosa, com foco em consulta, antropometria, visitas domiciliares e vacinação contra influenza previstas na nota metodológica.",
  },
  "c7-pccu-prevencao": {
    eyebrow: "Boas Práticas da APS",
    title: "C7 - PCCU e prevenção do câncer",
    description: "Indicador voltado ao cuidado longitudinal na prevenção do câncer, com foco em PCCU, vacinação HPV, atenção à saúde sexual e reprodutiva e mamografia conforme a nota metodológica.",
  },
  "lista-geral": {
    eyebrow: "Consolidação",
    title: "Lista geral dos pacientes monitorados",
    description: "Visualize a consolidação nominal dos pacientes processados, com expansão de detalhes e apoio à leitura integrada das pendências e evidências já encontradas.",
  },
  exportacao: {
    eyebrow: "Exportação",
    title: "Exportação de dados para CDS",
    description: "Exporte os dados essenciais dos pacientes monitorados em formato CSV, com filtros por seção, unidade, procedimentos, situação e classificação.",
  },
  auditoria: {
    eyebrow: "Controle",
    title: "Auditoria de procedimentos",
    description: "Acompanhe quais profissionais registraram procedimentos na plataforma, com filtros por data, unidade e profissional.",
  },
  "cadastro-municipal": {
    eyebrow: "Administração",
    title: "Cadastro Municipal",
    description: "Gerencie municípios, unidades de saúde e funções que compõem a estrutura organizacional da plataforma.",
  },
  perfis: {
    eyebrow: "Administração",
    title: "Perfis de Acesso",
    description: "Crie e gerencie perfis de acesso com permissões por seção da plataforma.",
  },
  "gestao-usuarios": {
    eyebrow: "Administração",
    title: "Gestão de Usuários",
    description: "Aprove, bloqueie e gerencie os usuários cadastrados na plataforma.",
  },
};

export const getSectionFromHash = (hash: string): SectionKey => {
  const normalizedHash = hash.replace(/^#/, "");
  const map: Record<string, SectionKey> = {
    upload: "upload",
    painel: "painel",
    dashboard: "painel",
    "c1-desenvolvimento-infantil": "c2-desenvolvimento-infantil",
    "c2-desenvolvimento-infantil": "c2-desenvolvimento-infantil",
    "c3-gestantes-puerperas": "c3-gestantes-puerperas",
    "c3-gestacao-puerperio": "c3-gestantes-puerperas",
    "c4-pessoas-diabetes": "c4-pessoas-diabetes",
    "c4-diabetes": "c4-pessoas-diabetes",
    "c5-pessoas-hipertensao": "c5-pessoas-hipertensao",
    "c5-hipertensao": "c5-pessoas-hipertensao",
    "c6-pessoa-idosa": "c6-pessoa-idosa",
    "c6-idosa": "c6-pessoa-idosa",
    "c6-idoso": "c6-pessoa-idosa",
    "c7-pccu-prevencao": "c7-pccu-prevencao",
    "c7-pccu": "c7-pccu-prevencao",
    "c7-prevencao": "c7-pccu-prevencao",
    "lista-geral": "lista-geral",
    exportacao: "exportacao",
    auditoria: "auditoria",
    "cadastro-municipal": "cadastro-municipal",
    perfis: "perfis",
    "gestao-usuarios": "gestao-usuarios",
  };
  return map[normalizedHash] || "conexao";
};
