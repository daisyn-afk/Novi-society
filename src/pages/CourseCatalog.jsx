// Redirects to the unified ProviderEnrollments page (Browse tab)
import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

export default function CourseCatalog() {
  const navigate = useNavigate();
  useEffect(() => {
    navigate(createPageUrl("ProviderEnrollments"), { replace: true });
  }, []);
  return null;
}