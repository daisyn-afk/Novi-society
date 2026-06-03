export function isCprBlsCert(cert) {
  const label = `${cert?.certification_name || cert?.cert_name || ""} ${cert?.issued_by || ""} ${cert?.category || ""}`;
  return /cpr|bls|basic life support|compliance/i.test(label) && !isBbpCert(cert);
}

export function isBbpCert(cert) {
  const label = `${cert?.certification_name || cert?.cert_name || ""} ${cert?.category || ""}`;
  return /bloodborne|bbp|pathogens/i.test(label);
}

export const CPR_BLS_CERT_NAME = "CPR/BLS Certification";
export const BBP_CERT_NAME = "Bloodborne Pathogens (BBP) Certification";
export const BBP_FREE_COURSE_URL =
  "https://www.redcross.org/take-a-class/program-aed/online-only/bloodborne-pathogens-training";
