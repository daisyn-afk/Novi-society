import { adminApiRequest } from "@/api/adminApiRequest";
import { adminUploadsApi } from "@/api/adminUploadsApi";
import { generateCourseCertificatePdf } from "@/lib/generateCourseCertificatePdf";
import {
  dataUrlToBlob,
  getCourseCertificationName,
  resolveCertificateExpiration,
} from "@/lib/certificateIssueForm";

function resolveCourseServiceType(course) {
  const awarded = Array.isArray(course?.certifications_awarded) ? course.certifications_awarded : [];
  const firstAwarded = awarded.find((entry) => entry?.service_type_id || entry?.service_type_name) || awarded[0] || null;
  const linkedIds = Array.isArray(course?.linked_service_type_ids) ? course.linked_service_type_ids : [];
  const linkedId = String(linkedIds[0] || "").trim() || null;
  return {
    service_type_id: String(firstAwarded?.service_type_id || linkedId || "").trim() || null,
    service_type_name: String(firstAwarded?.service_type_name || "").trim() || null,
  };
}

export async function issueCourseCertification({
  enrollment,
  course,
  issueForm = {},
  issuerName = "NOVI Platform",
  issuerEmail = null,
}) {
  const certificateNumber = `NOVI-${Date.now()}`;
  const issuedAt = new Date().toISOString();
  const certificationName = getCourseCertificationName(course);
  const expiresAt = resolveCertificateExpiration(issueForm);
  const signatureDataUrl = String(issueForm.issuer_signature_data || "").trim();
  const { service_type_id, service_type_name } = resolveCourseServiceType(course);

  let issuerSignatureUrl = null;
  if (signatureDataUrl) {
    const signatureBlob = dataUrlToBlob(signatureDataUrl);
    const signatureFile = new File([signatureBlob], `${certificateNumber}-signature.png`, { type: "image/png" });
    const uploadedSignature = await adminUploadsApi.uploadLicenseDocument(signatureFile);
    issuerSignatureUrl = uploadedSignature?.url || uploadedSignature?.file_url || null;
  }

  const created = await adminApiRequest("/admin/certifications", {
    method: "POST",
    body: JSON.stringify({
      provider_id: enrollment.provider_id,
      provider_email: enrollment.provider_email,
      provider_name: enrollment.provider_name,
      course_id: enrollment.course_id,
      enrollment_id: enrollment.id,
      certification_name: certificationName,
      category: course?.category,
      service_type_id,
      service_type_name,
      issued_by: issuerName,
      issued_by_email: issuerEmail,
      issued_at: issuedAt,
      expires_at: expiresAt,
      certificate_number: certificateNumber,
      issuer_signature_url: issuerSignatureUrl,
      status: "active",
    }),
  });

  const pdfBlob = await generateCourseCertificatePdf({
    providerName: enrollment.provider_name,
    certificationName,
    courseTitle: course?.title,
    certificateNumber: created?.certificate_number || certificateNumber,
    issuedAt,
    expiresAt,
    signatureDataUrl,
    signatureImageUrl: issuerSignatureUrl,
    signerName: issuerName,
  });
  const file = new File([pdfBlob], `${certificateNumber}.pdf`, { type: "application/pdf" });
  const uploaded = await adminUploadsApi.uploadLicenseDocument(file);
  const certificateUrl = uploaded?.url || uploaded?.file_url || null;

  if (!certificateUrl || !created?.id) {
    return created;
  }

  return adminApiRequest(`/admin/certifications/${created.id}`, {
    method: "PATCH",
    body: JSON.stringify({
      certificate_url: certificateUrl,
      certification_url: certificateUrl,
      document_url: certificateUrl,
      file_url: certificateUrl,
    }),
  });
}
