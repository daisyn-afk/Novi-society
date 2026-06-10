import { useEffect, useState } from "react";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createPageUrl } from "@/utils";
import {
  endMasterLoginSession,
  expireMasterLoginIfNeeded,
  getMasterLoginState,
} from "@/lib/masterLogin";

function formatRemaining(ms) {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${String(seconds).padStart(2, "0")}`;
}

function displayTargetName(target) {
  if (!target) return "this user";
  return target.full_name || [target.first_name, target.last_name].filter(Boolean).join(" ") || target.email || "this user";
}

export default function MasterLoginBanner() {
  const [state, setState] = useState(() => getMasterLoginState());

  useEffect(() => {
    const tick = () => {
      if (expireMasterLoginIfNeeded()) {
        window.location.href = createPageUrl("AdminUsers");
        return;
      }
      setState(getMasterLoginState());
    };

    tick();
    const intervalId = window.setInterval(tick, 1000);
    return () => window.clearInterval(intervalId);
  }, []);

  if (!state) return null;

  const handleExit = () => {
    endMasterLoginSession();
    window.location.href = createPageUrl("AdminUsers");
  };

  return (
    <div className="sticky top-0 z-[60] border-b border-amber-300 bg-amber-50 px-4 py-2">
      <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-amber-950">
          Master login as <strong>{displayTargetName(state.target)}</strong>
          {" "}— session ends in <strong>{formatRemaining(state.remainingMs)}</strong>.
          The user&apos;s password is unchanged.
        </p>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="border-amber-400 bg-white text-amber-950 hover:bg-amber-100"
          onClick={handleExit}
        >
          <LogOut className="mr-1 h-4 w-4" />
          Exit master login
        </Button>
      </div>
    </div>
  );
}
