import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import PracticeLaunchTab from "@/components/practice/PracticeLaunchTab";
import VendorDirectory from "@/components/launchpad/VendorDirectory";
import ProviderSalesLock from "@/components/ProviderSalesLock";
import { useProviderAccess } from "@/components/useProviderAccess";

const PAGE_TABS = [
  { id: "roadmap", label: "Launch Roadmap" },
  { id: "vendors", label: "Vendor Directory" },
];

export default function ProviderLaunchPad() {
  const [searchParams] = useSearchParams();
  const focusPhaseId = searchParams.get("phase");
  const focusStepId = searchParams.get("step");
  const [activeTab, setActiveTab] = useState("roadmap");
  const { status: accessStatus } = useProviderAccess();

  useEffect(() => {
    if (focusPhaseId || focusStepId) {
      setActiveTab("roadmap");
    }
  }, [focusPhaseId, focusStepId]);

  return (
    <ProviderSalesLock feature="launchpad" applicationStatus={accessStatus} requiredTier="full">
      <div className="max-w-4xl mx-auto">
        {/* Tab nav */}
        <div className="flex justify-center mb-6">
          <div
            className="inline-flex rounded-full p-1 gap-1"
            style={{ background: "rgba(255,255,255,0.65)", border: "1px solid rgba(30,37,53,0.08)" }}
          >
            {PAGE_TABS.map(({ id, label }) => {
              const isActive = activeTab === id;
              return (
                <button
                  key={id}
                  type="button"
                  onClick={() => setActiveTab(id)}
                  className="px-5 py-2.5 rounded-full text-sm font-bold transition-all outline-none"
                  style={{
                    background: isActive ? "#1e2535" : "transparent",
                    color: isActive ? "#C8E63C" : "rgba(30,37,53,0.55)",
                  }}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>

        {activeTab === "roadmap" && <PracticeLaunchTab />}
        {activeTab === "vendors" && <VendorDirectory />}
      </div>
    </ProviderSalesLock>
  );
}
