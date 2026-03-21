import { useEffect, useRef, useMemo, useSyncExternalStore } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { INDICATOR_CONFIGS, prefetchIndicatorData } from "@/hooks/useIndicatorData";
import { indicatorProgressTracker } from "@/lib/progress-tracker";
import type { ParsedSheet, SearchResult } from "@/types/reference-upload";

type SectionSheetMap = {
  c2: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c3: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c4: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c5: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c6: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
  c7: { sheet: ParsedSheet | null; results: Record<number, SearchResult> };
};

type UseSectionPrefetchParams = {
  activeSection: string;
  referenceUploadId: string | null;
  sections: Partial<SectionSheetMap>;
  enabled?: boolean;
};

const PREFETCH_DELAY_MS = 1000;

export function useSectionPrefetch({
  activeSection,
  referenceUploadId,
  sections,
  enabled = true,
}: UseSectionPrefetchParams) {
  const queryClient = useQueryClient();
  const timerRef = useRef<ReturnType<typeof setTimeout>>();
  const allKeys = useMemo(() => ["c2", "c3", "c4", "c5", "c6", "c7"], []);
  
  const sectionProgress = useSyncExternalStore(
    (l) => indicatorProgressTracker.subscribe(l),
    () => indicatorProgressTracker.getSnapshot()
  );

  // Check if all relevant data is actually in the cache already
  const queriesDone = useMemo(() => {
    if (!referenceUploadId) return false;
    return allKeys.every(key => {
      const sectionData = sections[key as keyof SectionSheetMap];
      if (!sectionData?.sheet) return true;
      const queryKey = ["indicator", key, sectionData.sheet.name, referenceUploadId];
      const state = queryClient.getQueryState(queryKey);
      return state?.status === "success";
    });
  }, [allKeys, sections, referenceUploadId, queryClient]);

  useEffect(() => {
    if (!enabled || !referenceUploadId) {
      if (!enabled) indicatorProgressTracker.reset();
      return;
    }

    if (timerRef.current) clearTimeout(timerRef.current);

    timerRef.current = setTimeout(() => {
      allKeys.forEach((key, idx) => {
        const sectionData = sections[key as keyof SectionSheetMap];
        const config = INDICATOR_CONFIGS[key];
        
        if (!config || !sectionData?.sheet) {
          indicatorProgressTracker.update(key, 100);
          return;
        }

        setTimeout(() => {
          prefetchIndicatorData(
            queryClient, 
            config, 
            sectionData.sheet, 
            sectionData.results, 
            referenceUploadId
          );
        }, idx * 500); 
      });
    }, PREFETCH_DELAY_MS);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [enabled, queryClient, referenceUploadId, sections, allKeys]);

  const overallProgress = useMemo(() => {
    if (queriesDone) return 100;
    
    // Calculate current sum
    let currentSum = 0;
    allKeys.forEach(key => {
      currentSum += (sectionProgress[key] || 0);
    });

    const totalPossible = allKeys.length * 100;
    if (totalPossible === 0) return 0;
    
    const percentage = Math.round((currentSum / totalPossible) * 100);
    
    // Safety: if any sections are complete but total is 0, something is wrong with keys
    if (currentSum > 0 && percentage === 0) return 1; 
    
    return Math.min(100, percentage);
  }, [sectionProgress, queriesDone, allKeys]);

  const isComplete = overallProgress >= 100 || queriesDone;

  return {
    sectionProgress,
    overallProgress,
    isComplete
  };
}
