import { ParsedSheet } from "@/types/reference-upload";

const normalizeSheetLabel = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();

export const findPreferredC3Sheet = (sheets: ParsedSheet[], fallbackSheetName: string) => {
  const fallbackSheet = sheets.find((sheet) => sheet.name === fallbackSheetName) ?? null;
  const c3Sheet =
    sheets.find((sheet) => {
      const normalized = normalizeSheetLabel(sheet.name);
      return normalized.includes("C3") && (normalized.includes("GESTANTE") || normalized.includes("PUERPERA"));
    }) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("C3")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("GESTANTE")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("PUERPERA")) ??
    null;
  return c3Sheet ?? fallbackSheet;
};

export const findPreferredC4Sheet = (sheets: ParsedSheet[], fallbackSheetName: string) => {
  const fallbackSheet = sheets.find((sheet) => sheet.name === fallbackSheetName) ?? null;
  const c4Sheet =
    sheets.find((sheet) => {
      const normalized = normalizeSheetLabel(sheet.name);
      return normalized.includes("C4") && normalized.includes("DIABET");
    }) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("C4")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("DIABET")) ??
    null;
  return c4Sheet ?? fallbackSheet;
};

export const findPreferredC5Sheet = (sheets: ParsedSheet[], fallbackSheetName: string) => {
  const fallbackSheet = sheets.find((sheet) => sheet.name === fallbackSheetName) ?? null;
  const c5Sheet =
    sheets.find((sheet) => {
      const normalized = normalizeSheetLabel(sheet.name);
      return normalized.includes("C5") && normalized.includes("HIPERTEN");
    }) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("C5")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("HIPERTEN")) ??
    null;
  return c5Sheet ?? fallbackSheet;
};

export const findPreferredC6Sheet = (sheets: ParsedSheet[], fallbackSheetName: string) => {
  const fallbackSheet = sheets.find((sheet) => sheet.name === fallbackSheetName) ?? null;
  const c6Sheet =
    sheets.find((sheet) => {
      const normalized = normalizeSheetLabel(sheet.name);
      return normalized.includes("C6") && (normalized.includes("IDOSA") || normalized.includes("IDOSO"));
    }) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("C6")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("IDOSA")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("IDOSO")) ??
    null;
  return c6Sheet ?? fallbackSheet;
};

export const findPreferredC7Sheet = (sheets: ParsedSheet[], fallbackSheetName: string) => {
  const fallbackSheet = sheets.find((sheet) => sheet.name === fallbackSheetName) ?? null;
  const c7Sheet =
    sheets.find((sheet) => {
      const normalized = normalizeSheetLabel(sheet.name);
      return normalized.includes("C7") && (normalized.includes("PCCU") || normalized.includes("PREVENCAO") || normalized.includes("CANCER"));
    }) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("C7")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("PCCU")) ??
    sheets.find((sheet) => normalizeSheetLabel(sheet.name).includes("PREVENCAO")) ??
    null;
  return c7Sheet ?? fallbackSheet;
};
