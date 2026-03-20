import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { useSectionPrefetch } from "@/hooks/useSectionPrefetch";
import { useAuth } from "@/contexts/AuthContext";
import { useReferenceUpload } from "@/hooks/useReferenceUpload";
import { Sidebar } from "@/components/layout/Sidebar";
import { MainHeader } from "@/components/layout/MainHeader";
import { Loader2 } from "lucide-react";

import { 
  SectionKey, 
  menuItems, 
  sectionTitles, 
  getSectionFromHash 
} from "@/constants/navigation";

import {
  findPreferredC3Sheet,
  findPreferredC4Sheet,
  findPreferredC5Sheet,
  findPreferredC6Sheet,
  findPreferredC7Sheet,
} from "@/lib/sheet-utils";

// Lazy loaded components
const ConnectionSection = lazy(() => import("@/components/ConnectionSection").then(m => ({ default: m.ConnectionSection })));
const UploadSection = lazy(() => import("@/components/UploadSection").then(m => ({ default: m.UploadSection })));
const IndicatorDashboardSection = lazy(() => import("@/components/IndicatorDashboardSection").then(m => ({ default: m.IndicatorDashboardSection })));
const C1DevelopmentSection = lazy(() => import("@/components/C1DevelopmentSection").then(m => ({ default: m.C1DevelopmentSection })));
const C2NominalListSection = lazy(() => import("@/components/C2NominalListSection").then(m => ({ default: m.C2NominalListSection })));
const C3GestationSection = lazy(() => import("@/components/C3GestationSection").then(m => ({ default: m.C3GestationSection })));
const C4DiabetesSection = lazy(() => import("@/components/C4DiabetesSection").then(m => ({ default: m.C4DiabetesSection })));
const C5HypertensionSection = lazy(() => import("@/components/C5HypertensionSection").then(m => ({ default: m.C5HypertensionSection })));
const C6OlderPersonSection = lazy(() => import("@/components/C6OlderPersonSection").then(m => ({ default: m.C6OlderPersonSection })));
const C7PccuPreventionSection = lazy(() => import("@/components/C7PccuPreventionSection").then(m => ({ default: m.C7PccuPreventionSection })));
const ExportCdsSection = lazy(() => import("@/components/export/ExportCdsSection").then(m => ({ default: m.ExportCdsSection })));
const AuditoriaSection = lazy(() => import("@/components/AuditoriaSection").then(m => ({ default: m.AuditoriaSection })));
const MunicipalRegistration = lazy(() => import("@/components/admin/MunicipalRegistration").then(m => ({ default: m.MunicipalRegistration })));
const ProfilesManagement = lazy(() => import("@/components/admin/ProfilesManagement").then(m => ({ default: m.ProfilesManagement })));
const UserManagement = lazy(() => import("@/components/admin/UserManagement").then(m => ({ default: m.UserManagement })));
const GeneralNominalListSection = lazy(() => import("@/components/GeneralNominalListSection").then(m => ({ default: m.GeneralNominalListSection })));

const Index = () => {
  const { appUser, hasAccess, isAdmin, signOut } = useAuth();
  const {
    sheets,
    setSheets,
    selectedSheetName,
    setSelectedSheetName,
    referenceUploadId,
    setReferenceUploadId,
    resultsBySheet,
    handleResultsChange,
    indicatorLoadStage,
    setIndicatorLoadStage,
  } = useReferenceUpload();

  const [activeSection, setActiveSection] = useState<SectionKey>(() => {
    const hashSection = getSectionFromHash(window.location.hash);
    if (isAdmin || hasAccess(hashSection)) return hashSection;
    return visibleMenu[0]?.section || "painel";
  });
  
  const [initialSearchFilter, setInitialSearchFilter] = useState("");

  const visibleMenu = useMemo(() => {
    return menuItems.filter((item) => {
      if (isAdmin) return true;
      return hasAccess(item.section);
    });
  }, [isAdmin, hasAccess]);

  useEffect(() => {
    const syncSectionWithHash = () => {
      const hashSection = getSectionFromHash(window.location.hash);
      if (isAdmin || hasAccess(hashSection)) {
        setActiveSection(hashSection);
      } else if (visibleMenu.length > 0) {
        // Redirect to first allowed section if unauthorized
        const firstSection = visibleMenu[0].section;
        window.location.hash = `#${firstSection}`;
        setActiveSection(firstSection);
      }
    };
    syncSectionWithHash();
    window.addEventListener("hashchange", syncSectionWithHash);
    return () => window.removeEventListener("hashchange", syncSectionWithHash);
  }, [isAdmin, hasAccess, visibleMenu]);

  const handleSectionChange = (section: SectionKey, search?: string) => {
    if (!isAdmin && !hasAccess(section)) return;
    setInitialSearchFilter(search || "");
    const nextHash = `#${section}`;
    if (window.location.hash === nextHash) {
      setActiveSection(section);
      return;
    }
    window.location.hash = nextHash;
  };

  const selectedSheet = useMemo(() => sheets.find((sheet) => sheet.name === selectedSheetName) ?? null, [sheets, selectedSheetName]);
  const results = useMemo(() => resultsBySheet[selectedSheetName] ?? {}, [resultsBySheet, selectedSheetName]);
  
  const sheetsBySection = useMemo(() => ({
    c2: selectedSheet,
    c3: findPreferredC3Sheet(sheets, selectedSheetName),
    c4: findPreferredC4Sheet(sheets, selectedSheetName),
    c5: findPreferredC5Sheet(sheets, selectedSheetName),
    c6: findPreferredC6Sheet(sheets, selectedSheetName),
    c7: findPreferredC7Sheet(sheets, selectedSheetName),
  }), [sheets, selectedSheet, selectedSheetName]);

  const resultsBySection = useMemo(() => ({
    c3: sheetsBySection.c3 ? resultsBySheet[sheetsBySection.c3.name] ?? {} : {},
    c4: sheetsBySection.c4 ? resultsBySheet[sheetsBySection.c4.name] ?? {} : {},
    c5: sheetsBySection.c5 ? resultsBySheet[sheetsBySection.c5.name] ?? {} : {},
    c6: sheetsBySection.c6 ? resultsBySheet[sheetsBySection.c6.name] ?? {} : {},
    c7: sheetsBySection.c7 ? resultsBySheet[sheetsBySection.c7.name] ?? {} : {},
  }), [resultsBySheet, sheetsBySection]);

  const currentSectionInfo = sectionTitles[activeSection];
  const isPreparingIndicatorData = referenceUploadId !== null && ["uploading", "matching", "indicator"].includes(indicatorLoadStage);

  const prefetchSections = useMemo(() => ({
    c3: { sheet: sheetsBySection.c3, results: resultsBySection.c3 },
    c4: { sheet: sheetsBySection.c4, results: resultsBySection.c4 },
    c5: { sheet: sheetsBySection.c5, results: resultsBySection.c5 },
    c6: { sheet: sheetsBySection.c6, results: resultsBySection.c6 },
    c7: { sheet: sheetsBySection.c7, results: resultsBySection.c7 },
  }), [sheetsBySection, resultsBySection]);

  useSectionPrefetch({
    activeSection,
    referenceUploadId,
    sections: prefetchSections,
    enabled: indicatorLoadStage === "ready",
  });

  const renderSection = () => {
    // Security check: if not authorized for this section, show nothing
    if (!isAdmin && !hasAccess(activeSection)) {
      return (
        <div className="flex flex-col items-center justify-center gap-4 rounded-3xl border border-dashed border-border bg-muted/30 py-16">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
        </div>
      );
    }

    switch (activeSection) {
      case "conexao": return <ConnectionSection />;
      case "upload":
        return (
          <UploadSection
            sheets={sheets} selectedSheetName={selectedSheetName} results={results}
            referenceUploadId={referenceUploadId} onReferenceUploadIdChange={setReferenceUploadId}
            onIndicatorLoadStageChange={setIndicatorLoadStage} onSheetsChange={setSheets}
            onSelectedSheetNameChange={setSelectedSheetName} onResultsChange={handleResultsChange}
          />
        );
      case "painel":
        return (
          <IndicatorDashboardSection
            sheets={sheets} selectedSheetName={selectedSheetName} resultsBySheet={resultsBySheet}
            referenceUploadId={referenceUploadId}
            sheetsBySection={sheetsBySection}
          />
        );
      case "c2-desenvolvimento-infantil":
        return (
          <C1DevelopmentSection 
            selectedSheet={selectedSheet} 
            results={results} 
            referenceUploadId={referenceUploadId} 
            isPreparingData={isPreparingIndicatorData}
            initialSearch={initialSearchFilter}
          />
        );
      case "c3-gestantes-puerperas":
        return (
          <C3GestationSection 
            selectedSheet={sheetsBySection.c3} 
            results={resultsBySection.c3} 
            referenceUploadId={referenceUploadId} 
            isPreparingData={isPreparingIndicatorData}
            initialSearch={initialSearchFilter}
          />
        );
      case "c4-pessoas-diabetes":
        return (
          <C4DiabetesSection 
            selectedSheet={sheetsBySection.c4} 
            results={resultsBySection.c4} 
            referenceUploadId={referenceUploadId} 
            isPreparingData={isPreparingIndicatorData}
            initialSearch={initialSearchFilter}
          />
        );
      case "c5-pessoas-hipertensao":
        return (
          <C5HypertensionSection 
            selectedSheet={sheetsBySection.c5} 
            results={resultsBySection.c5} 
            referenceUploadId={referenceUploadId} 
            isPreparingData={isPreparingIndicatorData}
            initialSearch={initialSearchFilter}
          />
        );
      case "c6-pessoa-idosa":
        return (
          <C6OlderPersonSection 
            selectedSheet={sheetsBySection.c6} 
            results={resultsBySection.c6} 
            referenceUploadId={referenceUploadId} 
            isPreparingData={isPreparingIndicatorData}
            initialSearch={initialSearchFilter}
          />
        );
      case "c7-pccu-prevencao":
        return (
          <C7PccuPreventionSection 
            selectedSheet={sheetsBySection.c7} 
            results={resultsBySection.c7} 
            referenceUploadId={referenceUploadId} 
            isPreparingData={isPreparingIndicatorData}
            initialSearch={initialSearchFilter}
          />
        );
      case "exportacao":
        return (
          <ExportCdsSection
            sheets={sheets} selectedSheetName={selectedSheetName} resultsBySheet={resultsBySheet}
            referenceUploadId={referenceUploadId}
            sheetsBySection={sheetsBySection}
          />
        );
      case "auditoria": return <AuditoriaSection />;
      case "cadastro-municipal": return <MunicipalRegistration />;
      case "perfis": return <ProfilesManagement />;
      case "gestao-usuarios": return <UserManagement />;
      case "lista-geral":
        return (
          <div className="space-y-4">
            <GeneralNominalListSection 
              sheetsBySection={sheetsBySection}
              onNavigateToSection={(section, patientName) => handleSectionChange(section as any, patientName)} 
            />
          </div>
        );
      default: return null;
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground lg:grid lg:grid-cols-[280px_1fr]">
      <Sidebar 
        menuItems={visibleMenu} 
        activeSection={activeSection} 
        onSectionChange={handleSectionChange}
        appUser={appUser}
        signOut={signOut}
      />

      <section className="min-w-0 px-5 py-6 md:px-8 lg:px-10 lg:py-8">
        <div className="mx-auto max-w-7xl space-y-6">
          <MainHeader 
            eyebrow={currentSectionInfo.eyebrow}
            title={currentSectionInfo.title}
            description={currentSectionInfo.description}
          />

          <Suspense fallback={
            <div className="flex h-[400px] items-center justify-center">
              <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
          }>
            <div className="animate-in fade-in slide-in-from-bottom-4 duration-500">
              {renderSection()}
            </div>
          </Suspense>
        </div>
      </section>
    </main>
  );
};

export default Index;
