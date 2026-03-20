import type { IndicatorFlag } from "@/types/reference-upload";

const normalizeComparableText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

export const isAnthropometryFlag = (flag: Pick<IndicatorFlag, "title" | "metric" | "summary">) => {
  const comparable = normalizeComparableText(`${flag.title} ${flag.metric} ${flag.summary}`);
  return comparable.includes("PESO E ALTURA") || comparable.includes("ANTROPOMETR");
};

const formatNumber = (value: number) =>
  new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: Number.isInteger(value) ? 0 : 1,
    maximumFractionDigits: 2,
  }).format(value);

export const formatWeightValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";
  return `${formatNumber(Number(value))} kg`;
};

export const formatHeightValue = (value: number | null | undefined) => {
  if (value === null || value === undefined || Number.isNaN(Number(value))) return "-";

  const numericValue = Number(value);
  if (numericValue > 3) return `${formatNumber(numericValue)} cm`;
  return `${formatNumber(numericValue)} m`;
};
