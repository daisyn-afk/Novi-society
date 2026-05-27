export function isCprBlsCert(cert) {
  const label = `${cert?.certification_name || cert?.cert_name || ""} ${cert?.issued_by || ""} ${cert?.category || ""}`;
  return /cpr|bls|basic life support|compliance/i.test(label);
}

export const CPR_BLS_CERT_NAME = "CPR/BLS Certification";
