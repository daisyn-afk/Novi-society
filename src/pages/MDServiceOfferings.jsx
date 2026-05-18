import { Navigate } from "react-router-dom";
import { createPageUrl } from "@/utils";

/** Legacy route — services are managed on MD Profile. */
export default function MDServiceOfferings() {
  return <Navigate to={createPageUrl("MDProfile")} replace />;
}
