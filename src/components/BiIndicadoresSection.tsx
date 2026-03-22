import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Info } from "lucide-react";

export const BiIndicadoresSection = () => {

  return (
    <div className="space-y-6">
      <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
        <CardContent className="p-6 md:p-8 space-y-4">
          <Alert className="bg-primary/5 border-primary/20">
            <Info className="h-5 w-5 text-primary" />
            <AlertTitle className="text-primary font-bold">Em construção</AlertTitle>
            <AlertDescription className="text-muted-foreground mt-2">
              Esta seção está sendo desenvolvida. Em breve, você terá acesso a um painel gerencial avançado (BI) 
              focado em extrair inteligência, gráficos e insights cruzados de todos os seus indicadores APS.
            </AlertDescription>
          </Alert>

          <div className="rounded-3xl border border-dashed border-border bg-background/50 h-[400px] flex items-center justify-center">
            <p className="text-sm text-muted-foreground animate-pulse">
              Preparando fontes de dados do BI...
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
