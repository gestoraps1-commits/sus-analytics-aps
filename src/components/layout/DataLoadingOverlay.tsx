import React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, CheckCircle2, Loader2 } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";

interface DataLoadingOverlayProps {
  isVisible: boolean;
  onSkip: () => void;
  overallProgress: number;
  sectionProgress: Record<string, number>;
}

const INDICATOR_LABELS: Record<string, string> = {
  c2: "C2 - Desenv. Infantil",
  c3: "C3 - Gestantes e Puérperas",
  c4: "C4 - Pessoa com Diabetes",
  c5: "C5 - Pessoa com Hipertensão",
  c6: "C6 - Pessoa Idosa",
  c7: "C7 - PCCU e Prevenção",
};

export function DataLoadingOverlay({
  isVisible,
  onSkip,
  overallProgress,
  sectionProgress,
}: DataLoadingOverlayProps) {
  const [showSafetyEnter, setShowSafetyEnter] = React.useState(false);

  React.useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(() => setShowSafetyEnter(true), 12000);
      return () => clearTimeout(timer);
    } else {
      setShowSafetyEnter(false);
    }
  }, [isVisible]);

  if (!isVisible) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[999] flex flex-col items-center justify-center bg-background p-6 overflow-hidden"
      >
        <div className="absolute inset-0 overflow-hidden pointer-events-none">
          <div className="absolute -top-[10%] -left-[10%] w-[40%] h-[40%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
          <div className="absolute -bottom-[10%] -right-[10%] w-[40%] h-[40%] bg-primary/5 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: "1s" }} />
        </div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 0.1, type: "spring", stiffness: 100 }}
          className="text-center space-y-2 mb-2"
        >
          <h1 className="text-4xl md:text-5xl font-black tracking-tighter text-foreground">
            Seja bem-vindo(a)!
          </h1>
          <p className="text-muted-foreground font-medium text-lg">
            Estamos preparando sua experiência no SUS Analytics.
          </p>
        </motion.div>

        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          transition={{ delay: 0.2, type: "spring", stiffness: 100 }}
          className="relative z-10 w-full max-w-2xl flex flex-col items-center gap-8"
        >
          <div className="relative group">
            <motion.div
              animate={{
                boxShadow: ["0 0 0px rgba(59, 130, 246, 0)", "0 0 40px rgba(59, 130, 246, 0.1)", "0 0 0px rgba(59, 130, 246, 0)"],
              }}
              transition={{ duration: 4, repeat: Infinity }}
              className="rounded-3xl p-6 bg-white/40 backdrop-blur-md border border-white/20 shadow-2xl"
            >
              <img
                src="/logo-full.png"
                alt="SUS Analytics Logo"
                className="w-auto h-28 md:h-32 object-contain"
                onError={(e) => {
                   e.currentTarget.style.display = 'none';
                }}
              />
            </motion.div>
          </div>

          <div className="w-full space-y-2 text-center text-balance px-4">
            <h2 className="text-xl md:text-2xl font-bold tracking-tight bg-gradient-to-r from-primary to-blue-400 bg-clip-text text-transparent">
              Processando Indicadores
            </h2>
            <p className="text-muted-foreground text-xs border-b border-primary/10 pb-4">Otimizando o cruzamento nominal para análise instantânea.</p>
          </div>

          <div className="w-full bg-white/30 backdrop-blur-sm rounded-3xl p-6 border border-white/20 shadow-xl space-y-6">
            <div className="space-y-3">
              <div className="flex justify-between text-sm font-semibold">
                <span className="flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-primary" />
                    Processamento Global
                </span>
                <span className="text-primary font-bold">{overallProgress}%</span>
              </div>
              <Progress value={overallProgress} className="h-3 bg-white/50" />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pb-2">
              {Object.entries(INDICATOR_LABELS).map(([key, label]) => {
                const progress = sectionProgress[key] || 0;
                const isDone = progress >= 100;

                return (
                  <div key={key} className="flex flex-col gap-1.5 p-3 rounded-xl bg-white/40 border border-white/10 transition-all hover:bg-white/60 group">
                    <div className="flex items-center justify-between text-[11px] font-medium">
                      <span className="truncate pr-2 text-muted-foreground group-hover:text-foreground transition-colors">{label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {isDone ? (
                          <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                            <CheckCircle2 className="w-3.5 h-3.5 text-green-500" />
                          </motion.div>
                        ) : (
                          <span className="text-primary/70 font-mono tracking-tighter">{progress}%</span>
                        )}
                      </div>
                    </div>
                    <Progress value={progress} className="h-1 bg-white/40 transition-all" />
                  </div>
                );
              })}
            </div>
          </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex flex-col items-center gap-4 w-full relative z-[1001]"
        >
          <Button
            variant="default"
            size="lg"
            onClick={(e) => {
                console.log("[Overlay] Skip button clicked");
                onSkip();
            }}
            className="w-full md:w-auto bg-primary hover:bg-primary/90 text-primary-foreground rounded-full px-12 h-14 font-bold shadow-2xl transition-all active:scale-95 text-lg"
          >
            Entrar no Sistema
          </Button>
          
          <p className="text-[11px] text-muted-foreground/60 text-center max-w-[300px]">
            Os indicadores continuam carregando em segundo plano mesmo se você entrar agora.
          </p>
        </motion.div>
        </motion.div>

        <div className="absolute bottom-6 text-center w-full px-4">
            <div className="flex items-center justify-center gap-2 text-[9px] uppercase tracking-[0.3em] font-semibold text-muted-foreground/40 text-pretty">
                <span>Plataforma de Inteligência em Atenção Primária à Saúde</span>
            </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
