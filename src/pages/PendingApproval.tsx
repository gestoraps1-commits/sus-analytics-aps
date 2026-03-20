import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, XCircle, Ban, Heart } from "lucide-react";

export default function PendingApproval() {
  const { appUser, signOut } = useAuth();
  const status = appUser?.status;

  const config = getStatusConfig(status);

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md text-center">
        <CardHeader>
          <div className={`mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full ${config.iconBg}`}>
            {config.icon}
          </div>
          <CardTitle className="text-xl">{config.title}</CardTitle>
          <CardDescription className="text-base">{config.message}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {status === "reprovado" && (
            <Button variant="default" className="w-full" onClick={() => { window.location.href = "/cadastro"; }}>
              Realizar nova inscrição
            </Button>
          )}
          <Button variant="outline" className="w-full" onClick={signOut}>
            Sair
          </Button>
        </CardContent>
      </Card>
    </main>
  );
}

function getStatusConfig(status: string | undefined) {
  switch (status) {
    case "reprovado":
      return {
        title: "Cadastro Reprovado",
        message: "Seu cadastro foi reprovado. Você pode realizar uma nova inscrição com o mesmo email.",
        icon: <XCircle className="h-7 w-7 text-red-600" />,
        iconBg: "bg-red-100",
      };
    case "bloqueado":
      return {
        title: "Acesso Bloqueado",
        message: "Seu acesso está bloqueado. Procure o administrador.",
        icon: <Ban className="h-7 w-7 text-red-600" />,
        iconBg: "bg-red-100",
      };
    case "pendente_aprovacao":
    default:
      return {
        title: "Aguardando Aprovação",
        message: "Seu cadastro está em análise. Aguarde a liberação do administrador.",
        icon: <Clock className="h-7 w-7 text-amber-600" />,
        iconBg: "bg-amber-100",
      };
  }
}
