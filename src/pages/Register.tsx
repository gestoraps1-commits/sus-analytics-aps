import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Heart, Loader2 } from "lucide-react";
import { toast } from "sonner";

interface SelectOption { id: string; name: string; }

export default function Register() {
  const { signUp } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const [municipalities, setMunicipalities] = useState<SelectOption[]>([]);
  const [healthUnits, setHealthUnits] = useState<SelectOption[]>([]);
  const [jobFunctions, setJobFunctions] = useState<SelectOption[]>([]);
  const [profiles, setProfiles] = useState<SelectOption[]>([]);

  const [form, setForm] = useState({
    nome_completo: "", cpf: "", cns: "", municipality_id: "", health_unit_id: "",
    job_function_id: "", profile_id: "", telefone: "", email: "", password: "",
  });

  useEffect(() => {
    supabase.from("municipalities").select("id, name").eq("is_active", true).order("name").then(({ data }) => setMunicipalities(data || []));
    supabase.from("job_functions").select("id, name").eq("is_active", true).order("name").then(({ data }) => setJobFunctions(data || []));
    supabase.from("access_profiles").select("id, name").eq("is_active", true).order("name").then(({ data }) => setProfiles(data || []));
  }, []);

  useEffect(() => {
    if (form.municipality_id) {
      supabase.from("health_units").select("id, name").eq("municipality_id", form.municipality_id).eq("is_active", true).order("name")
        .then(({ data }) => setHealthUnits(data || []));
    } else {
      setHealthUnits([]);
    }
    setForm((f) => ({ ...f, health_unit_id: "" }));
  }, [form.municipality_id]);

  const updateField = (key: string, value: string) => setForm((f) => ({ ...f, [key]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.nome_completo || !form.email || !form.password) {
      toast.error("Preencha nome, email e senha.");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Senha deve ter ao menos 6 caracteres.");
      return;
    }
    setLoading(true);
    const { error } = await signUp(form);
    setLoading(false);
    if (error) {
      toast.error(error);
      return;
    }
    // Sign out to ensure clean state, then redirect to waiting page info
    await supabase.auth.signOut();
    toast.success("Seu cadastro foi enviado e está aguardando aprovação do administrador.");
    navigate("/login");
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-background p-4">
      <Card className="w-full max-w-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-lg">
            <Heart className="h-6 w-6" />
          </div>
          <CardTitle className="text-2xl font-black">Cadastro</CardTitle>
          <CardDescription>Preencha seus dados para solicitar acesso</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-3">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div className="space-y-1 sm:col-span-2">
                <Label>Nome completo *</Label>
                <Input value={form.nome_completo} onChange={(e) => updateField("nome_completo", e.target.value)} required />
              </div>
              <div className="space-y-1">
                <Label>CPF</Label>
                <Input value={form.cpf} onChange={(e) => updateField("cpf", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>CNS</Label>
                <Input value={form.cns} onChange={(e) => updateField("cns", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Município</Label>
                <Select value={form.municipality_id} onValueChange={(v) => updateField("municipality_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{municipalities.map((m) => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Unidade de Saúde</Label>
                <Select value={form.health_unit_id} onValueChange={(v) => updateField("health_unit_id", v)} disabled={!form.municipality_id}>
                  <SelectTrigger><SelectValue placeholder={form.municipality_id ? "Selecione" : "Selecione município primeiro"} /></SelectTrigger>
                  <SelectContent>{healthUnits.map((u) => <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Função</Label>
                <Select value={form.job_function_id} onValueChange={(v) => updateField("job_function_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{jobFunctions.map((f) => <SelectItem key={f.id} value={f.id}>{f.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Perfil solicitado</Label>
                <Select value={form.profile_id} onValueChange={(v) => updateField("profile_id", v)}>
                  <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                  <SelectContent>{profiles.map((p) => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label>Telefone</Label>
                <Input value={form.telefone} onChange={(e) => updateField("telefone", e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label>Email *</Label>
                <Input type="email" value={form.email} onChange={(e) => updateField("email", e.target.value)} required />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <Label>Senha *</Label>
                <Input type="password" value={form.password} onChange={(e) => updateField("password", e.target.value)} required minLength={6} />
              </div>
            </div>
            <Button type="submit" className="w-full" disabled={loading}>
              {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Solicitar Cadastro
            </Button>
          </form>
          <div className="mt-4 text-center text-sm text-muted-foreground">
            Já possui conta?{" "}
            <button type="button" onClick={() => navigate("/login")} className="text-primary underline hover:text-primary/80">Entrar</button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
