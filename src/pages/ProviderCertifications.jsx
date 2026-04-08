// Redirects to the unified ProviderCredentialsCoverage page (certs tab)
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function ProviderCertifications() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(createPageUrl("ProviderCredentialsCoverage") + "?tab=certs", { replace: true });
  }, []);
  return null;
}