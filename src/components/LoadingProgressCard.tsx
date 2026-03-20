import { Loader2 } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

type LoadingProgressCardProps = {
  title: string;
  description: string;
  value: number;
};

export const LoadingProgressCard = ({ title, description, value }: LoadingProgressCardProps) => {
  return (
    <Card className="overflow-hidden border-border/80 bg-card/90 shadow-sm">
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <p className="text-sm font-semibold text-foreground">{title}</p>
            <p className="text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-full border border-border bg-background/80">
            <Loader2 className="h-4 w-4 animate-spin text-accent" />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">
            <span>Processando</span>
            <span>{Math.round(value)}%</span>
          </div>
          <Progress value={value} className="h-3" />
        </div>
      </CardContent>
    </Card>
  );
};