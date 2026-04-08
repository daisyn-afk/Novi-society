import React from "react";
import { useQuery } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, CheckCircle, Clock, XCircle, FileText, Award, Shield } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";

/**
 * CREDENTIAL HIERARCHY DISPLAY:
 * 
 * LICENSE (Foundation) → CERTIFICATION (Qualification) → MD SUBSCRIPTION (Active Practice)
 * 
 * Clear visual distinction between the three credential types
 */

export default function CredentialStatusPanel() {
  const { data: user } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me()
  });

  const { data: licenses = [] } = useQuery({
    queryKey: ["my-licenses"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.License.filter({ provider_id: me.id }, "-created_date");
    },
    enabled: !!user
  });

  const { data: certs = [] } = useQuery({
    queryKey: ["my-certs"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Certification.filter({ provider_id: me.id }, "-created_date");
    },
    enabled: !!user
  });

  const { data: mdSubs = [] } = useQuery({
    queryKey: ["my-md-subs"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: me.id }, "-created_date");
    },
    enabled: !!user
  });

  const activeLicense = licenses.find(l => l.status === 'verified');
  const activeCerts = certs.filter(c => c.status === 'active');
  const activeSubs = mdSubs.filter(s => s.status === 'active');
  const suspendedSubs = mdSubs.filter(s => s.status === 'suspended');

  const getStatusIcon = (status) => {
    switch (status) {
      case 'verified':
      case 'active': return <CheckCircle className="w-4 h-4 text-green-600" />;
      case 'pending_review':
      case 'pending': return <Clock className="w-4 h-4 text-yellow-600" />;
      case 'expired':
      case 'suspended': return <AlertTriangle className="w-4 h-4 text-orange-600" />;
      case 'rejected':
      case 'revoked':
      case 'inactive': return <XCircle className="w-4 h-4 text-red-600" />;
      default: return null;
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'verified':
      case 'active': return 'bg-green-50 text-green-700 border-green-200';
      case 'pending_review':
      case 'pending': return 'bg-yellow-50 text-yellow-700 border-yellow-200';
      case 'expired':
      case 'suspended': return 'bg-orange-50 text-orange-700 border-orange-200';
      case 'rejected':
      case 'revoked':
      case 'inactive': return 'bg-red-50 text-red-700 border-red-200';
      default: return 'bg-slate-50 text-slate-700 border-slate-200';
    }
  };

  return (
    <div className="space-y-4">
      {/* Critical Alerts */}
      {!activeLicense && (
        <Alert className="border-red-200 bg-red-50">
          <AlertTriangle className="h-4 w-4 text-red-600" />
          <AlertDescription className="text-red-700 font-semibold">
            No active professional license found. Upload your RN/NP/PA/MD license to continue.
          </AlertDescription>
        </Alert>
      )}

      {suspendedSubs.length > 0 && (
        <Alert className="border-orange-200 bg-orange-50">
          <AlertTriangle className="h-4 w-4 text-orange-600" />
          <AlertDescription className="text-orange-700 font-semibold">
            {suspendedSubs.length} MD Board subscription(s) suspended. Check credential requirements below.
          </AlertDescription>
        </Alert>
      )}

      {/* 1. PROFESSIONAL LICENSE */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <FileText className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-base">Professional License</CardTitle>
            <Badge variant="outline" className="ml-auto text-xs">Foundation Credential</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            State-issued medical/nursing license. Required for ALL platform activity.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {licenses.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No license uploaded</p>
          ) : (
            licenses.map(lic => (
              <div key={lic.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{lic.license_type}</p>
                    <Badge className={getStatusColor(lic.status)}>
                      {getStatusIcon(lic.status)}
                      <span className="ml-1">{lic.status.replace('_', ' ')}</span>
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600">#{lic.license_number} • {lic.issuing_state}</p>
                  {lic.expiration_date && (
                    <p className="text-xs text-slate-500 mt-1">
                      Expires: {new Date(lic.expiration_date).toLocaleDateString()}
                      {lic.expiration_date < new Date().toISOString().split('T')[0] && 
                        <span className="text-red-600 font-semibold ml-2">EXPIRED</span>
                      }
                    </p>
                  )}
                  {lic.status === 'expired' && (
                    <p className="text-xs text-orange-600 font-semibold mt-1">
                      ⚠️ Upload renewed license to reactivate subscriptions
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 2. CERTIFICATIONS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Award className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-base">Service Certifications</CardTitle>
            <Badge variant="outline" className="ml-auto text-xs">Training Qualifications</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            NOVI course completions or external certifications. Required to sign up for MD subscriptions.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {certs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No certifications earned</p>
          ) : (
            certs.map(cert => (
              <div key={cert.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{cert.certification_name}</p>
                    <Badge className={getStatusColor(cert.status)}>
                      {getStatusIcon(cert.status)}
                      <span className="ml-1">{cert.status}</span>
                    </Badge>
                  </div>
                  {cert.service_type_name && (
                    <p className="text-xs text-slate-600">Qualifies for: {cert.service_type_name}</p>
                  )}
                  <p className="text-xs text-slate-500">
                    Issued: {new Date(cert.issued_at).toLocaleDateString()}
                  </p>
                  {cert.expires_at && (
                    <p className="text-xs text-slate-500">
                      Expires: {new Date(cert.expires_at).toLocaleDateString()}
                      {cert.expires_at < new Date().toISOString().split('T')[0] && 
                        <span className="text-red-600 font-semibold ml-2">EXPIRED</span>
                      }
                    </p>
                  )}
                  {cert.status === 'expired' && (
                    <p className="text-xs text-orange-600 font-semibold mt-1">
                      ⚠️ Renew certification to reactivate related MD subscriptions
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* 3. MD BOARD SUBSCRIPTIONS */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-slate-600" />
            <CardTitle className="text-base">MD Board Subscriptions</CardTitle>
            <Badge variant="outline" className="ml-auto text-xs">Active Practice Authorization</Badge>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Monthly memberships for medical director oversight. Active subscription = can perform treatments.
          </p>
        </CardHeader>
        <CardContent className="space-y-2">
          {mdSubs.length === 0 ? (
            <p className="text-sm text-slate-400 italic">No MD subscriptions yet</p>
          ) : (
            mdSubs.map(sub => (
              <div key={sub.id} className="flex items-start justify-between p-3 bg-slate-50 rounded-lg border">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-semibold text-sm">{sub.service_type_name}</p>
                    <Badge className={getStatusColor(sub.status)}>
                      {getStatusIcon(sub.status)}
                      <span className="ml-1">{sub.status}</span>
                    </Badge>
                  </div>
                  {sub.activated_at && (
                    <p className="text-xs text-slate-500">
                      Active since: {new Date(sub.activated_at).toLocaleDateString()}
                    </p>
                  )}
                  {sub.status === 'suspended' && sub.suspension_reason && (
                    <div className="mt-2 p-2 bg-orange-50 border border-orange-200 rounded">
                      <p className="text-xs text-orange-700 font-semibold">Suspended:</p>
                      <p className="text-xs text-orange-600">{sub.suspension_reason}</p>
                    </div>
                  )}
                  {sub.status === 'active' && (
                    <p className="text-xs text-green-600 font-semibold mt-1">
                      ✓ Authorized to perform {sub.service_type_name} treatments
                    </p>
                  )}
                </div>
              </div>
            ))
          )}
        </CardContent>
      </Card>

      {/* Legend */}
      <Card className="bg-slate-50">
        <CardContent className="pt-4">
          <p className="text-xs font-semibold text-slate-700 mb-2">Credential Hierarchy:</p>
          <div className="space-y-1 text-xs text-slate-600">
            <p>1. <strong>License</strong> = Professional credential (RN, NP, etc.) - Foundation for everything</p>
            <p>2. <strong>Certification</strong> = Training proof (NOVI course or external) - Qualifies for services</p>
            <p>3. <strong>MD Subscription</strong> = Monthly membership ($) - Active practice authorization</p>
          </div>
          <div className="mt-3 pt-3 border-t border-slate-200">
            <p className="text-xs text-slate-500 italic">
              <strong>Key rule:</strong> MD Subscription requires both active License AND active Certification. If either expires, subscription auto-suspends.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}