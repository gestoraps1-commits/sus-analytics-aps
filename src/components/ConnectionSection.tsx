import { useMemo, useState } from "react";
import { DatabaseZap, Loader2, ServerCrash, ShieldCheck } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Kpi = {
  label: string;
  value: string;
  helper: string;
};

type TopTable = {
  schema: string;
  name: string;
  estimatedRows: number;
  totalSize: string;
};

type ConnectionResult = {
  success: boolean;
  message?: string;
  error?: string;
  hint?: string;
  connection?: {
    host: string;
    port: number;
    database: string;
    user: string;
    serverTime: string;
  };
  kpis?: Kpi[];
  topTables?: TopTable[];
};

export const ConnectionSection = () => {
  const [isConnecting, setIsConnecting] = useState(false);
  const [result, setResult] = useState<ConnectionResult | null>(null);

  const statusTone = useMemo(() => {
    if (!result) return "idle";
    return result.success ? "success" : "error";
  }, [result]);

  const handleConnect = async () => {
    setIsConnecting(true);
    setResult(null);

    try {
      const { data, error } = await supabase.functions.invoke("test-remote-db", { body: {} });

      if (error) {
        throw new Error(error.message || "Não foi possível conectar ao banco e-SUS.");
      }

      setResult(data as ConnectionResult);
    } catch (error) {
      setResult({
        success: false,
        error: error instanceof Error ? error.message : "Falha inesperada ao conectar no banco e-SUS.",
        hint: "Verifique se o servidor aceita conexões remotas e se as credenciais do backend estão corretas.",
      });
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
      <CardContent className="space-y-5 p-5 md:p-6">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">Conexão</p>
            <h3 className="text-2xl font-black tracking-tight text-foreground">Lógica de conexão com o banco e-SUS</h3>
            <p className="max-w-2xl text-sm leading-6 text-muted-foreground">
              Esta seção centraliza a chamada segura ao backend para validar a conexão, devolver status do banco e preparar a próxima etapa de extração das regras.
            </p>
          </div>

          <Button
            type="button"
            size="lg"
            onClick={handleConnect}
            disabled={isConnecting}
            className="rounded-full px-6 shadow-lg shadow-accent/20"
          >
            {isConnecting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Conectando...
              </>
            ) : (
              <>
                <DatabaseZap className="h-4 w-4" />
                Conectar ao e-SUS
              </>
            )}
          </Button>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <div className="rounded-3xl border border-border bg-background/70 p-4">
            <div className="grid gap-4 md:grid-cols-3">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Servidor</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {result?.connection?.host ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Banco</p>
                <p className="mt-2 text-base font-semibold text-foreground">
                  {result?.connection?.database ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Segurança</p>
                <p className="mt-2 inline-flex items-center gap-2 text-base font-semibold text-foreground">
                  <ShieldCheck className="h-4 w-4 text-accent" />
                  Backend seguro
                </p>
              </div>
            </div>
          </div>

          <div className="rounded-3xl border border-border bg-secondary/40 p-4">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Status atual</p>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">
              {statusTone === "idle" && "Aguardando validação da conexão para liberar as próximas camadas de regras e extração."}
              {statusTone === "success" && `Conectado em ${new Date(result?.connection?.serverTime ?? Date.now()).toLocaleString("pt-BR")}.`}
              {statusTone === "error" && "A conexão falhou. Revise o retorno abaixo para corrigir antes de seguir."}
            </p>
          </div>
        </div>

        {result && statusTone === "success" && result.kpis && (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {result.kpis.map((kpi) => (
              <div key={kpi.label} className="rounded-2xl border border-border bg-background/70 p-4">
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{kpi.label}</p>
                <p className="mt-2 text-2xl font-black text-foreground">{kpi.value}</p>
                <p className="mt-1 text-xs text-muted-foreground">{kpi.helper}</p>
              </div>
            ))}
          </div>
        )}

        {result && statusTone === "success" && result.topTables && result.topTables.length > 0 && (
          <div className="rounded-2xl border border-border bg-background/70 p-4">
            <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">Top 5 tabelas (por linhas)</p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                    <th className="pb-2 pr-4">Tabela</th>
                    <th className="pb-2 pr-4 text-right">Linhas</th>
                    <th className="pb-2 text-right">Tamanho</th>
                  </tr>
                </thead>
                <tbody>
                  {result.topTables.map((t) => (
                    <tr key={`${t.schema}.${t.name}`} className="border-b border-border/50">
                      <td className="py-2 pr-4 font-medium text-foreground">{t.name}</td>
                      <td className="py-2 pr-4 text-right text-muted-foreground">{new Intl.NumberFormat("pt-BR").format(t.estimatedRows)}</td>
                      <td className="py-2 text-right text-muted-foreground">{t.totalSize}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {result && statusTone === "success" && (
          <Alert className="border-accent/30 bg-accent/10 text-foreground">
            <ShieldCheck className="h-4 w-4" />
            <AlertTitle>{result.message}</AlertTitle>
            <AlertDescription>
              <div className="mt-3 grid gap-3 text-sm md:grid-cols-2 xl:grid-cols-4">
                <div>
                  <span className="text-muted-foreground">Host:</span> {result.connection?.host}
                </div>
                <div>
                  <span className="text-muted-foreground">Porta:</span> {result.connection?.port}
                </div>
                <div>
                  <span className="text-muted-foreground">Usuário:</span> {result.connection?.user}
                </div>
                <div>
                  <span className="text-muted-foreground">Banco:</span> {result.connection?.database}
                </div>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {result && statusTone === "error" && (
          <Alert variant="destructive">
            <ServerCrash className="h-4 w-4" />
            <AlertTitle>Falha na conexão</AlertTitle>
            <AlertDescription>
              <div className="space-y-2">
                <p>{result.error}</p>
                {result.hint ? <p>{result.hint}</p> : null}
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};
