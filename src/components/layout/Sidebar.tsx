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
      <div className="px-6 py-8">
        <div className="flex flex-col gap-5">
          <div className="flex h-12 w-auto items-center justify-start transition-all hover:scale-[1.02] duration-300">
            <img 
              src="/logo-full.png" 
              alt="SUS Analytics" 
              className="h-full w-auto object-contain opacity-100" 
            />
          </div>
          
          <div className="relative">
            <div className="absolute -top-3 left-0 w-full h-[1px] bg-white/10" />
            <div className="pt-2">
              <h1 className="text-[22px] font-black tracking-tighter text-white leading-none">
                SUS-ANALYTICS
              </h1>
              <p className="mt-2 text-[11px] font-bold tracking-[0.25em] text-white/40 uppercase leading-none">
                DADOS QUE CUIDAM
              </p>
            </div>
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
