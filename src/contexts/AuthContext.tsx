import { createContext, useContext, useEffect, useState, ReactNode, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { User } from "@supabase/supabase-js";

interface AppUser {
  id: string;
  auth_user_id: string;
  nome_completo: string;
  email: string;
  status: string;
  acesso: boolean;
  precisa_trocar_senha: boolean;
  is_master_admin: boolean;
  municipality_id: string | null;
  health_unit_id: string | null;
  job_function_id: string | null;
  profile_id: string | null;
  cpf: string | null;
  cns: string | null;
  telefone: string | null;
  roles?: string[];
}

interface Permission {
  section_key: string;
  access_level: string;
}

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  permissions: Permission[];
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signUp: (data: Record<string, string>) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
  hasAccess: (sectionKey: string, minLevel?: string) => boolean;
  isAdmin: boolean;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};

const ACCESS_LEVELS = ["sem_acesso", "visualizacao", "edicao", "admin_total"];

/** Max time (ms) to wait for initial auth before showing UI anyway */
const AUTH_TIMEOUT_MS = 5_000;

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [permissions, setPermissions] = useState<Permission[]>([]);
  const [loading, setLoading] = useState(true);

  // Guard against double-init race between onAuthStateChange and getSession
  const initializedRef = useRef(false);

  const currentUserAuthIdRef = useRef<string | null>(null);

  const fetchAppUser = useCallback(async (authUserId: string) => {
    // ... existing implementation remains here ...
    console.log("[AuthContext] fetchAppUser started for UID:", authUserId);
    try {
      console.log("[AuthContext] Fetching app_users...");
      const { data, error: userError } = await supabase
        .from("app_users")
        .select("*")
        .eq("auth_user_id", authUserId)
        .maybeSingle();

      if (userError) {
        console.error("[AuthContext] Error fetching app_users:", userError);
      } else {
        console.log("[AuthContext] app_users fetched:", data ? "found" : "not found");
      }

      console.log("[AuthContext] Fetching user_roles...");
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authUserId);

      if (rolesError) {
        console.error("[AuthContext] Error fetching user_roles:", rolesError);
      } else {
        console.log("[AuthContext] user_roles fetched:", userRoles?.length || 0);
      }

      const appUserData = data as AppUser | null;
      if (appUserData) {
        appUserData.roles = (userRoles as { role: string }[] || []).map(r => r.role);
      }
      setAppUser(appUserData);

      if (data?.profile_id) {
        const { data: perms } = await supabase
          .from("profile_permissions")
          .select("section_key, access_level")
          .eq("profile_id", data.profile_id);
        setPermissions((perms as Permission[]) || []);
      } else {
        setPermissions([]);
      }
      return data as AppUser | null;
    } catch (err) {
      console.warn("[AuthContext] fetchAppUser failed:", err);
      setAppUser(null);
      setPermissions([]);
      return null;
    }
  }, []);

  useEffect(() => {
    // Safety timeout: always unblock UI even if Supabase is unreachable
    const timeout = setTimeout(() => {
      if (!initializedRef.current) {
        console.warn("[AuthContext] Auth init timed out after", AUTH_TIMEOUT_MS, "ms");
        initializedRef.current = true;
        setLoading(false);
      }
    }, AUTH_TIMEOUT_MS);

    // Single init function — called by whichever fires first
    const initAuth = async (sessionUser: User | null) => {
      if (initializedRef.current) return; // already handled
      initializedRef.current = true;

      setUser(sessionUser);
      currentUserAuthIdRef.current = sessionUser?.id || null;
      
      if (sessionUser) {
        await fetchAppUser(sessionUser.id);
      }
      setLoading(false);
    };

    supabase.auth.getSession().then(({ data: { session } }) => {
      initAuth(session?.user ?? null);
    }).catch(() => {
      initAuth(null);
    });

    // Listen for subsequent auth changes (sign-in, sign-out, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {

      if (!initializedRef.current) {
        initAuth(session?.user ?? null);
        return;
      }

      // Subsequent events: update state and profile
      setUser(prev => {
        if (prev?.id === session?.user?.id) return prev;
        return session?.user ?? null;
      });

      if (session?.user) {
        if (currentUserAuthIdRef.current !== session.user.id) {
          currentUserAuthIdRef.current = session.user.id;
          setLoading(true);
          await fetchAppUser(session.user.id);
          setLoading(false);
        }
      } else {
        currentUserAuthIdRef.current = null;
        setAppUser(null);
        setPermissions([]);
      }
    });

    return () => {
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [fetchAppUser]);

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    return {};
  };

  const signUp = async (data: Record<string, string>) => {
    const { email, password, nome_completo, cpf, cns, municipality_id, health_unit_id, job_function_id, profile_id, telefone } = data;

    const { data: authData, error: authError } = await supabase.auth.signUp({ email, password });

    if (authError) {
      if (authError.message.includes("already registered") || authError.message.includes("already been registered")) {
        return await handleReRegistration(data);
      }
      return { error: authError.message };
    }

    if (!authData.user) return { error: "Erro ao criar usuário" };

    if (authData.user.identities && authData.user.identities.length === 0) {
      return await handleReRegistration(data);
    }

    const { error: profileError } = await supabase.from("app_users").insert({
      auth_user_id: authData.user.id,
      email,
      nome_completo,
      cpf: cpf || null,
      cns: cns || null,
      municipality_id: municipality_id || null,
      health_unit_id: health_unit_id || null,
      job_function_id: job_function_id || null,
      profile_id: profile_id || null,
      telefone: telefone || null,
      status: "pendente_aprovacao" as const,
      acesso: false,
    });
    if (profileError) return { error: profileError.message };
    return {};
  };

  const handleReRegistration = async (data: Record<string, string>) => {
    const { email, password, nome_completo, cpf, cns, municipality_id, health_unit_id, job_function_id, profile_id, telefone } = data;

    const { data: signInData, error: signInError } = await supabase.auth.signInWithPassword({ email, password });

    if (signInError) {
      return { error: "Este email já está cadastrado. Se foi reprovado, use a mesma senha anterior ou entre em contato com o administrador." };
    }

    const { data: existingAppUser } = await supabase
      .from("app_users")
      .select("id, status")
      .eq("auth_user_id", signInData.user.id)
      .maybeSingle();

    if (!existingAppUser) {
      const { error: profileError } = await supabase.from("app_users").insert({
        auth_user_id: signInData.user.id,
        email,
        nome_completo,
        cpf: cpf || null,
        cns: cns || null,
        municipality_id: municipality_id || null,
        health_unit_id: health_unit_id || null,
        job_function_id: job_function_id || null,
        profile_id: profile_id || null,
        telefone: telefone || null,
        status: "pendente_aprovacao" as const,
        acesso: false,
      });
      await supabase.auth.signOut();
      if (profileError) return { error: profileError.message };
      return {};
    }

    if (existingAppUser.status !== "reprovado") {
      await supabase.auth.signOut();
      const messages: Record<string, string> = {
        pendente_aprovacao: "Seu cadastro já está em análise. Aguarde a liberação do administrador.",
        aprovado: "Este email já possui uma conta ativa. Faça login.",
        bloqueado: "Este email está bloqueado. Entre em contato com o administrador.",
        inativo: "Este email está inativo. Entre em contato com o administrador.",
      };
      return { error: messages[existingAppUser.status] || "Este email já está cadastrado." };
    }

    const { error: updateError } = await supabase.from("app_users").update({
      nome_completo,
      cpf: cpf || null,
      cns: cns || null,
      municipality_id: municipality_id || null,
      health_unit_id: health_unit_id || null,
      job_function_id: job_function_id || null,
      profile_id: profile_id || null,
      telefone: telefone || null,
      status: "pendente_aprovacao" as const,
      acesso: false,
    }).eq("id", existingAppUser.id);

    await supabase.auth.signOut();
    if (updateError) return { error: updateError.message };
    return {};
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setAppUser(null);
    setPermissions([]);
  };

  const hasAccess = (sectionKey: string, minLevel = "visualizacao") => {
    if (appUser?.is_master_admin) return true;
    const perm = permissions.find((p) => p.section_key === sectionKey);
    if (!perm) return false;
    return ACCESS_LEVELS.indexOf(perm.access_level) >= ACCESS_LEVELS.indexOf(minLevel);
  };

  const refreshAppUser = async () => {
    if (user) await fetchAppUser(user.id);
  };

  const isAdmin = appUser?.is_master_admin || appUser?.roles?.includes("admin") || false;

  return (
    <AuthContext.Provider value={{ user, appUser, permissions, loading, signIn, signUp, signOut, hasAccess, isAdmin, refreshAppUser }}>
      {children}
    </AuthContext.Provider>
  );
}
