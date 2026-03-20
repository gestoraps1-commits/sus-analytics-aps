import { Heart, LogOut, LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

type MenuItem = {
  label: string;
  icon: LucideIcon;
  section: string;
};

type SidebarProps = {
  menuItems: MenuItem[];
  activeSection: string;
  onSectionChange: (section: any) => void;
  appUser: any;
  signOut: () => void;
};

export const Sidebar = ({ menuItems, activeSection, onSectionChange, appUser, signOut }: SidebarProps) => {
  return (
    <aside className="flex min-h-screen flex-col border-r border-border bg-primary text-primary-foreground">
      <div className="border-b border-primary-foreground/10 px-6 py-7">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-accent text-accent-foreground shadow-lg transition-transform hover:scale-110">
            <Heart className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <h1 className="truncate text-xl font-black tracking-tight">Boas Práticas - APS</h1>
            <p className="mt-1 text-sm text-primary-foreground/70">Sus Analytics · Dados que orientam cuidado</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
        {menuItems.map(({ label, icon: Icon, section }) => {
          const isActive = activeSection === section;
          return (
            <button
              key={label}
              type="button"
              onClick={() => onSectionChange(section)}
              aria-current={isActive ? "page" : undefined}
              className={cn(
                "flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-left text-sm font-medium transition-all group",
                isActive
                  ? "bg-primary-foreground/12 text-primary-foreground shadow-sm"
                  : "text-primary-foreground/72 hover:bg-primary-foreground/10 hover:text-primary-foreground",
              )}
            >
              <Icon className={cn("h-4 w-4 transition-transform group-hover:scale-120", isActive && "text-accent")} />
              <span>{label}</span>
            </button>
          );
        })}
      </nav>

      <div className="space-y-4 border-t border-primary-foreground/10 px-4 py-5">
        <div className="flex items-center justify-between rounded-2xl bg-primary-foreground/5 px-4 py-3 glass-panel border border-primary-foreground/10">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold">{appUser?.nome_completo || appUser?.email || "Usuário"}</p>
            <p className="text-xs text-primary-foreground/70">{appUser?.is_master_admin ? "Admin Master" : "Usuário"}</p>
          </div>
          {appUser?.is_master_admin && (
            <span className="rounded-full bg-accent px-3 py-1 text-xs font-bold text-accent-foreground shadow-sm">Admin</span>
          )}
        </div>

        <button
          type="button"
          onClick={() => signOut()}
          className="flex w-full items-center gap-3 rounded-2xl px-4 py-3 text-sm text-primary-foreground/72 transition-all hover:bg-primary-foreground/6 hover:text-primary-foreground group"
        >
          <LogOut className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
          Sair
        </button>
      </div>
    </aside>
  );
};
