import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { INDICATOR_CONFIGS, prefetchIndicatorData } from "@/hooks/useIndicatorData";
import type { ParsedSheet, SearchResult } from "@/types/reference-upload";

type SectionSheetMap = {
  c3: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c4: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c5: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c6: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c7: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
};

type UseSectionPrefetchParams = {
  activeSection: string;
  referenceUploadId: string | null;
  sections: SectionSheetMap;
  enabled?: boolean;
};

const PREFETCH_DELAY_MS = 2000;

/**
 * After the active section finishes loading, prefetch the remaining
 * indicator sections in the background with a small delay to avoid
 * overwhelming the browser.
 */
export function useSectionPrefetch({
  activeSection,
  referenceUploadId,
  sections,
  enabled = true,
}: UseSectionPrefetchParams) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (!enabled || !referenceUploadId) return;

    // Clear any pending prefetch
    if (timerRef.current) clearTimeout(timerRef.current);

    // Determine which section is currently active (extract indicator key)
    const activeSectionKey = activeSection.match(/c(\d)/)?.[0] ?? "";

    // Wait before prefetching to let active section load first
    timerRef.current = setTimeout(() => {
      const sectionKeys = Object.keys(sections) as (keyof SectionSheetMap)[];

      // Prefetch sections one at a time with staggered delay
      sectionKeys.forEach((key, idx) => {
        if (key === activeSectionKey) return; // skip active section

        const { sheet, results } = sections[key];
        const config = INDICATOR_CONFIGS[key];
        if (!config || !sheet) return;

        setTimeout(() => {
          prefetchIndicatorData(queryClient, config, sheet, results, referenceUploadId);
        }, idx * 1500); // stagger by 1.5s
      });
    }, PREFETCH_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [activeSection, enabled, queryClient, referenceUploadId, sections]);
}
