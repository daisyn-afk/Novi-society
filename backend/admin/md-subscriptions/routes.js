import { Router } from "express";
import { query } from "../db.js";
import { getMeFromAccessToken } from "../auth/service.js";
import {
  getProviderIdAliases,
  isMedicalDirectorRole,
  mdHasActiveSupervisionOf,
} from "../mdSupervisedAccess.js";
import { getGlobalMdContractUrl, isUsableMdContractUrl } from "../lib/globalMdContract.js";
import { resolveProtocolDocumentsForSubscription } from "../lib/mdSubscriptionProtocolDocs.js";
import {
  assertCanAddMdCoverageService,
  enrichMdSubscriptionMonthlyFees,
  monthlyFeeForNewMdService,
} from "../mdMembershipPricing.js";
import { ensureSignedContractForSubscription, finalizeMdBoardCoverage } from "../mdBillingService.js";

export const mdSubscriptionsRouter = Router();

function getBearerToken(req) {
  const raw = req.headers.authorization || "";
  if (!raw.startsWith("Bearer ")) return null;
  return raw.slice("Bearer ".length).trim() || null;
}

function hasAdminAccess(role) {
  const normalized = String(role || "").trim().toLowerCase();
  return normalized === "admin" || normalized === "super_admin" || normalized === "owner";
}

async function respondWithSubscriptions(res, rows) {
  const serviceTypeIds = [
    ...new Set(
      (rows || []).map((row) => String(row?.service_type_id || "").trim()).filter(Boolean)
    ),
  ];
  const contractByServiceId = new Map();
  let globalMdContractUrl = "";
  if (serviceTypeIds.length) {
    const { rows: serviceTypes } = await query(
      `select id, name, md_contract_url, md_agreement_text, protocol_document_urls, coverage_tiers
         from public.service_type
        where id::text = any($1::text[])`,
      [serviceTypeIds]
    );
    for (const st of serviceTypes || []) {
      contractByServiceId.set(String(st.id), st);
    }
  }
  globalMdContractUrl = await getGlobalMdContractUrl();
  const sanitized = (rows || []).map((row) => {
    const { signature_data: _sig, ...rest } = row || {};
    const st = contractByServiceId.get(String(row?.service_type_id || ""));
    const mdContractUrl = isUsableMdContractUrl(st?.md_contract_url)
      ? st.md_contract_url
      : globalMdContractUrl || null;
    return {
      ...rest,
      md_contract_url: mdContractUrl,
      md_agreement_text: st?.md_agreement_text || null,
      protocol_document_urls: resolveProtocolDocumentsForSubscription(row),
    };
  });
  return res.json(enrichMdSubscriptionMonthlyFees(sanitized));
}

mdSubscriptionsRouter.get("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const providerIdFilter = String(req.query.provider_id || "").trim();
    const statusFilter = String(req.query.status || "").trim().toLowerCase();
    const isPatient = String(me.role || "").trim().toLowerCase() === "patient";

    if (isPatient || hasAdminAccess(me.role)) {
      const where = [];
      const params = [];
      if (providerIdFilter) {
        params.push(providerIdFilter);
        where.push(`provider_id = $${params.length}`);
      }
      if (statusFilter) {
        params.push(statusFilter);
        where.push(`lower(status) = $${params.length}`);
      }
      const whereSql = where.length ? `where ${where.join(" and ")}` : "";
      const { rows } = await query(
        `select * from public.md_subscription
         ${whereSql}
         order by created_at desc nulls last
         limit 500`,
        params
      );
      return respondWithSubscriptions(res, rows);
    }

    if (isMedicalDirectorRole(me.role)) {
      if (providerIdFilter) {
        const allowed = await mdHasActiveSupervisionOf(me, providerIdFilter);
        if (!allowed) {
          return res.status(403).json({ error: "Forbidden." });
        }
        const { aliases } = await getProviderIdAliases(providerIdFilter);
        const where = [`provider_id::text = any($1::text[])`];
        const params = [aliases];
        if (statusFilter) {
          params.push(statusFilter);
          where.push(`lower(status) = $${params.length}`);
        }
        const { rows } = await query(
          `select * from public.md_subscription
           where ${where.join(" and ")}
           order by created_at desc nulls last
           limit 200`,
          params
        );
        return respondWithSubscriptions(res, rows);
      }
      const { rows: rels } = await query(
        `select provider_id from public.medical_director_relationship
         where medical_director_id = $1 and lower(coalesce(status, '')) = 'active'`,
        [me.id]
      );
      const providerIds = [...new Set((rels || []).map((r) => String(r.provider_id || "").trim()).filter(Boolean))];
      if (!providerIds.length) return res.json([]);
      const { rows } = await query(
        `select * from public.md_subscription
         where provider_id::text = any($1::text[])
         order by created_at desc nulls last
         limit 500`,
        [providerIds]
      );
      return respondWithSubscriptions(res, rows);
    }

    const { aliases } = await getProviderIdAliases(me.id);
    const providerIds = aliases?.length ? aliases : [me.id];
    const { rows } = await query(
      `select * from public.md_subscription
       where provider_id::text = any($1::text[])
       order by created_at desc nulls last
       limit 200`,
      [providerIds]
    );
    return respondWithSubscriptions(res, rows);
  } catch (error) {
    return next(error);
  }
});

mdSubscriptionsRouter.post("/:id/signed-contract", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id is required." });

    const { rows: subRows } = await query(
      `select * from public.md_subscription where id = $1::uuid limit 1`,
      [id]
    );
    const sub = subRows[0];
    if (!sub) return res.status(404).json({ error: "Subscription not found." });

    const isOwner = String(sub.provider_id || "") === String(me.id);
    const isMd =
      isMedicalDirectorRole(me.role) && (await mdHasActiveSupervisionOf(me, sub.provider_id));
    if (!hasAdminAccess(me.role) && !isOwner && !isMd) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const bodySignature = req.body?.signature_data != null ? String(req.body.signature_data) : null;
    const signedContractUrl = await ensureSignedContractForSubscription(sub, {
      force: true,
      signatureData: bodySignature || sub.signature_data,
      signedByName: sub.signed_by_name,
      signedAtIso: sub.signed_at,
    });
    if (!signedContractUrl) {
      return res.status(502).json({ error: "Could not generate signed contract PDF." });
    }

    return res.json({ ok: true, signed_contract_url: signedContractUrl });
  } catch (error) {
    return next(error);
  }
});

mdSubscriptionsRouter.get("/:id/billing-events", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const id = String(req.params.id || "").trim();
    if (!id) return res.status(400).json({ error: "id is required." });

    const { rows: subRows } = await query(
      `select * from public.md_subscription where id = $1::uuid limit 1`,
      [id]
    );
    const sub = subRows[0];
    if (!sub) return res.status(404).json({ error: "Subscription not found." });

    const isOwner = String(sub.provider_id || "") === String(me.id);
    const isMd =
      isMedicalDirectorRole(me.role) && (await mdHasActiveSupervisionOf(me, sub.provider_id));
    if (!hasAdminAccess(me.role) && !isOwner && !isMd) {
      return res.status(403).json({ error: "Forbidden." });
    }

    const { rows } = await query(
      `select * from public.md_subscription_billing_event
       where md_subscription_id = $1::uuid
       order by created_at desc
       limit 100`,
      [id]
    );
    return res.json(rows || []);
  } catch (error) {
    return next(error);
  }
});

mdSubscriptionsRouter.post("/", async (req, res, next) => {
  try {
    const token = getBearerToken(req);
    if (!token) return res.status(401).json({ error: "Missing bearer token." });
    const me = await getMeFromAccessToken(token);
    const body = req.body || {};
    const providerId = String(body.provider_id || "").trim() || me.id;
    if (!hasAdminAccess(me.role) && providerId !== me.id) {
      return res.status(403).json({ error: "Forbidden." });
    }
    const serviceTypeId = String(body.service_type_id || "").trim();
    if (!serviceTypeId) {
      return res.status(400).json({ error: "service_type_id is required." });
    }
    const status = String(body.status || "active").trim() || "active";
    let monthlyFee =
      body.service_type_monthly_fee != null && String(body.service_type_monthly_fee).trim() !== ""
        ? Number(body.service_type_monthly_fee)
        : null;
    const { rows: existingActive } = await query(
      `select id from public.md_subscription
       where provider_id = $1
         and lower(coalesce(status, '')) = 'active'
         and coalesce(service_type_id::text, '') <> $2`,
      [providerId, serviceTypeId]
    );
    const activeOtherCount = (existingActive || []).length;
    if (String(status).toLowerCase() === "active") {
      const capCheck = assertCanAddMdCoverageService(activeOtherCount);
      if (!capCheck.ok) {
        return res.status(400).json({ error: capCheck.error });
      }
    }
    if (monthlyFee == null || !Number.isFinite(monthlyFee)) {
      monthlyFee = monthlyFeeForNewMdService(activeOtherCount);
    }
    const { rows } = await query(
      `insert into public.md_subscription (
        provider_id, provider_email, provider_name, service_type_id, service_type_name,
        service_type_monthly_fee, status, signed_at, signed_by_name, activated_at, enrollment_id, signature_data
      ) values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      returning *`,
      [
        providerId,
        body.provider_email || me.email || null,
        body.provider_name || me.full_name || null,
        serviceTypeId,
        body.service_type_name || null,
        monthlyFee,
        status,
        body.signed_at || null,
        body.signed_by_name || me.full_name || null,
        body.activated_at || null,
        body.enrollment_id != null && String(body.enrollment_id).trim() !== "" ? String(body.enrollment_id) : null,
        body.signature_data != null ? String(body.signature_data) : null
      ]
    );
    return res.status(201).json(rows[0]);
  } catch (error) {
    return next(error);
  }
});
