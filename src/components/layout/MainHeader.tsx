import { ShieldCheck } from "lucide-react";

type MainHeaderProps = {
  eyebrow: string;
  title: string;
  description: string;
};

export const MainHeader = ({ eyebrow, title, description }: MainHeaderProps) => {
  return (
    <header className="flex flex-col gap-4 rounded-[2rem] border border-border bg-card/80 p-6 shadow-sm md:flex-row md:items-end md:justify-between glass-panel">
      <div className="max-w-4xl animate-in fade-in slide-in-from-left duration-700">
        <p className="text-sm uppercase tracking-[0.2em] text-muted-foreground">{eyebrow}</p>
        <h2 className="mt-2 text-3xl font-black tracking-tight md:text-4xl text-foreground">{title}</h2>
        <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground md:text-base">{description}</p>
      </div>
      <div className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-4 py-2 text-sm text-muted-foreground shadow-sm transition-all hover:shadow-md">
        <ShieldCheck className="h-4 w-4 text-accent" />
        Acesso controlado por perfil
      </div>
    </header>
  );
};
