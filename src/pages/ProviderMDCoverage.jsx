import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import {
  Shield, CheckCircle, CheckCircle2, Clock, AlertTriangle, Search, Plus,
  Calendar, KeyRound, Award, PenLine, Zap, ChevronRight, RotateCcw, Upload,
  Star, BookOpen, Users, BarChart3, Lock, DollarSign, FileText
} from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format, differenceInMonths } from "date-fns";

const CERT_TYPES = ["RN", "NP", "PA", "MD", "DO", "esthetician", "other"];

const ACTIVATION_STEPS = ["Verify Training", "Select Service", "Sign & Activate"];

// NOVI plan / feature highlights
const NOVI_FEATURES = [
  { icon: Shield, label: "MD Supervision & Coverage", desc: "Full medical director oversight per service" },
  { icon: BookOpen, label: "NOVI Certified Training", desc: "Nationally recognized aesthetic certifications" },
  { icon: Users, label: "Medical Director Network", desc: "Access to vetted supervising physicians" },
  { icon: CheckCircle2, label: "Scope of Practice Enforcement", desc: "Real-time protocol & unit limit guidance" },
  { icon: Calendar, label: "Patient Booking Platform", desc: "Built-in scheduling & appointment management" },
  { icon: BarChart3, label: "Compliance Tracking", desc: "License management and audit-ready logs" },
];

export default function ProviderMDCoverage() {
  const [activeTab, setActiveTab] = useState("coverage");
  const [activateDialog, setActivateDialog] = useState(false);
  const [requestDialog, setRequestDialog] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");

  // Activation multi-step state
  const [step, setStep] = useState(0);
  const [classCode, setClassCode] = useState("");
  const [codeError, setCodeError] = useState("");
  const [verifiedSession, setVerifiedSession] = useState(null);
  const [useExternalCert, setUseExternalCert] = useState(false);
  const [certForm, setCertForm] = useState({ cert_type: "RN", issuing_school: "", cert_name: "" });
  const [certFile, setCertFile] = useState(null);
  const [certFileUrl, setCertFileUrl] = useState("");
  const [uploadingCert, setUploadingCert] = useState(false);
  const [certSubmitted, setCertSubmitted] = useState(false);
  const [selectedServiceTypeId, setSelectedServiceTypeId] = useState(null);
  const [hasSigned, setHasSigned] = useState(false);
  const canvasRef = useRef(null);
  const isDrawing = useRef(false);

  const queryClient = useQueryClient();

  const { data: me } = useQuery({ queryKey: ["me"], queryFn: () => base44.auth.me() });

  const { data: serviceTypes = [] } = useQuery({
    queryKey: ["service-types"],
    queryFn: () => base44.entities.ServiceType.filter({ is_active: true }),
  });

  const { data: mySubscriptions = [] } = useQuery({
    queryKey: ["my-md-subscriptions"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.MDSubscription.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments-coverage"],
    queryFn: async () => {
      const user = await base44.auth.me();
      return base44.entities.Enrollment.filter({ provider_id: user.id });
    },
    enabled: !!me,
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses-coverage"],
    queryFn: () => base44.entities.Course.list(),
  });

  const { data: relationships = [] } = useQuery({
    queryKey: ["my-md-relationships"],
    queryFn: async () => {
      if (!me) return [];
      return base44.entities.MedicalDirectorRelationship.filter({ provider_id: me.id });
    },
    enabled: !!me,
  });

  const { data: medicalDirectors = [] } = useQuery({
    queryKey: ["medical-directors"],
    queryFn: async () => {
      const allUsers = await base44.entities.User.list();
      return allUsers.filter(u => u.role === "medical_director");
    },
  });

  // Canvas signature setup
  useEffect(() => {
    if (!activateDialog || step !== 2) return;
    setTimeout(() => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const ctx = canvas.getContext("2d");
      ctx.strokeStyle = "#1A1A2E";
      ctx.lineWidth = 2.5;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
    }, 100);
  }, [activateDialog, step]);

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    return { x: clientX - rect.left, y: clientY - rect.top };
  };

  const startDraw = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    isDrawing.current = true;
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    e.preventDefault();
  };
  const draw = (e) => {
    if (!isDrawing.current) return;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    const pos = getPos(e, canvas);
    ctx.lineTo(pos.x, pos.y);
    ctx.stroke();
    setHasSigned(true);
    e.preventDefault();
  };
  const endDraw = () => { isDrawing.current = false; };
  const clearSignature = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setHasSigned(false);
  };

  const uploadCertFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setUploadingCert(true);
    const { file_url } = await base44.integrations.Core.UploadFile({ file });
    setCertFileUrl(file_url);
    setUploadingCert(false);
  };

  const submitExternalCertMutation = useMutation({
    mutationFn: async () =>
      base44.entities.Certification.create({
        provider_id: me.id,
        provider_email: me.email,
        provider_name: me.full_name,
        certification_name: certForm.cert_name,
        issued_by: certForm.issuing_school,
        category: certForm.cert_type,
        certificate_url: certFileUrl,
        status: "pending",
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-certs"] });
      setCertSubmitted(true);
    },
  });

  const verifyCodeMutation = useMutation({
    mutationFn: async () => {
      const sessions = await base44.entities.ClassSession.filter({ provider_id: me.id, session_code: classCode });
      if (sessions.length === 0) throw new Error("Invalid class code. Please check with your instructor.");
      return sessions[0];
    },
    onSuccess: (session) => {
      setVerifiedSession(session);
      setCodeError("");
      setStep(1);
    },
    onError: (err) => setCodeError(err.message),
  });

  const activateMutation = useMutation({
    mutationFn: async () => {
      const canvas = canvasRef.current;
      const signatureData = canvas.toDataURL("image/png");
      const now = new Date().toISOString();
      await base44.entities.ClassSession.update(verifiedSession.id, {
        attendance_confirmed: true,
        code_used: true,
        code_used_at: now,
      });
      await base44.entities.MDSubscription.create({
        provider_id: me.id,
        provider_email: me.email,
        provider_name: me.full_name,
        service_type_id: selectedServiceTypeId,
        service_type_name: serviceTypes.find(s => s.id === selectedServiceTypeId)?.name,
        status: "active",
        signed_at: now,
        signature_data: signatureData,
        signed_by_name: me.full_name,
        activated_at: now,
        enrollment_id: verifiedSession.enrollment_id,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-md-subscriptions"] });
      queryClient.invalidateQueries({ queryKey: ["my-class-sessions"] });
      setActivateDialog(false);
      resetActivation();
    },
  });

  const requestRelationshipMutation = useMutation({
    mutationFn: async (mdId) => {
      const md = medicalDirectors.find(m => m.id === mdId);
      return base44.entities.MedicalDirectorRelationship.create({
        provider_id: me.id,
        provider_email: me.email,
        provider_name: me.full_name,
        medical_director_id: mdId,
        medical_director_email: md.email,
        medical_director_name: md.full_name,
        status: "pending",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my-md-relationships"] });
      setRequestDialog(false);
      setSearchEmail("");
    },
  });

  const resetActivation = () => {
    setStep(0);
    setClassCode("");
    setCodeError("");
    setVerifiedSession(null);
    setUseExternalCert(false);
    setCertForm({ cert_type: "RN", issuing_school: "", cert_name: "" });
    setCertFileUrl("");
    setCertSubmitted(false);
    setSelectedServiceTypeId(null);
    setHasSigned(false);
  };

  // Check if today matches any enrollment's session date
  const today = format(new Date(), "yyyy-MM-dd");
  const hasTodayClass = myEnrollments.some(e =>
    e.session_date && e.session_date.startsWith(today) &&
    (e.status === "confirmed" || e.status === "paid")
  );

  const alreadyActiveServices = mySubscriptions.filter(s => s.status === "active").map(s => s.service_type_id);

  // Fixed pricing: $299 first service, $199 each additional
  const FIRST_SERVICE_PRICE = 299;
  const ADDON_SERVICE_PRICE = 199;
  const getMembershipPrice = () =>
    alreadyActiveServices.length === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE;

  // Build the set of service type IDs the provider has earned via completed NOVI courses
  const completedEnrollments = myEnrollments.filter(e =>
    e.status === "completed" || e.status === "attended"
  );
  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const earnedServiceTypeIds = new Set(
    completedEnrollments.flatMap(e => {
      const course = courseMap[e.course_id];
      return course?.linked_service_type_ids || [];
    })
  );

  // Services the provider has completed a course for, not yet activated
  const availableServices = serviceTypes.filter(s =>
    !alreadyActiveServices.includes(s.id) && earnedServiceTypeIds.has(s.id)
  );
  const activeSubscriptions = mySubscriptions.filter(s => s.status === "active");
  const selectedService = serviceTypes.find(s => s.id === selectedServiceTypeId);

  const existingMDIds = relationships.map(r => r.medical_director_id);
  const activeRelationships = relationships.filter(r => r.status === "active");
  const pendingRelationships = relationships.filter(r => r.status === "pending");
  const filteredMDs = medicalDirectors.filter(md =>
    md.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
    md.full_name.toLowerCase().includes(searchEmail.toLowerCase())
  ).filter(md => !existingMDIds.includes(md.id));

  return (
    <div className="max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">MD Coverage & Activation</h2>
          <p className="text-slate-500 text-sm mt-1">View plans, apply for medical director coverage, and manage your supervision</p>
        </div>
        <Button
          onClick={() => { setActivateDialog(true); resetActivation(); }}
          style={{ background: "#FA6F30", color: "#fff" }}
          className="font-semibold gap-2"
        >
          <Zap className="w-4 h-4" />
          Apply for Coverage
        </Button>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="coverage">NOVI Coverage Plans</TabsTrigger>
          <TabsTrigger value="active">My Coverage {activeSubscriptions.length > 0 && `(${activeSubscriptions.length})`}</TabsTrigger>
          <TabsTrigger value="supervision">MD Supervision</TabsTrigger>
        </TabsList>

        {/* COVERAGE PLANS TAB */}
        <TabsContent value="coverage" className="space-y-6 pt-4">
          {/* Hero Banner */}
          <div className="rounded-2xl p-8 text-white" style={{ background: "linear-gradient(135deg, var(--novi-dark) 0%, var(--novi-accent) 100%)" }}>
            <p className="text-xs font-semibold uppercase tracking-widest mb-2" style={{ color: "var(--novi-gold)" }}>
              THE COMPLETE AESTHETIC PROVIDER PLATFORM
            </p>
            <h3 className="text-3xl font-bold mb-3">NOVI MD Coverage</h3>
            <p className="text-white/70 text-base max-w-xl">
              Get medically supervised coverage for every aesthetic service you offer — backed by licensed medical directors, real-time scope enforcement, and comprehensive compliance tools.
            </p>
          </div>

          {/* Features Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {NOVI_FEATURES.map(({ icon: Icon, label, desc }) => (
              <div key={label} className="flex items-start gap-3 bg-white rounded-xl p-4 border border-slate-100 shadow-sm">
                <div className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0" style={{ background: "rgba(201,169,110,0.15)" }}>
                  <Icon className="w-4 h-4" style={{ color: "var(--novi-gold)" }} />
                </div>
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{desc}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Service Plans */}
          <div>
            <h3 className="font-semibold text-slate-900 text-lg mb-4">Available Service Coverage Plans</h3>
            {serviceTypes.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-slate-400">No service plans available yet.</CardContent>
              </Card>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {serviceTypes.map(service => {
                  const isActive = alreadyActiveServices.includes(service.id);
                  return (
                    <Card key={service.id} className={`relative overflow-hidden ${isActive ? "border-green-300" : ""}`}>
                      {isActive && (
                        <div className="absolute top-3 right-3">
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>
                      )}
                      <CardContent className="pt-5 pb-4 space-y-3">
                        <div>
                          <p className="font-bold text-slate-900 text-base">{service.name}</p>
                          <p className="text-xs text-slate-500 capitalize">{service.category?.replace("_", " ")}</p>
                        </div>

                        <div className="flex items-baseline gap-1">
                          <span className="text-2xl font-bold text-slate-900">
                            ${isActive ? (alreadyActiveServices.indexOf(service.id) === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE) : (alreadyActiveServices.length === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE)}
                          </span>
                          <span className="text-sm text-slate-500">/month</span>
                          {!isActive && alreadyActiveServices.length > 0 && (
                            <span className="ml-1 text-xs text-green-600 font-semibold">add-on</span>
                          )}
                        </div>

                        {service.description && (
                          <p className="text-sm text-slate-600">{service.description}</p>
                        )}

                        {service.allowed_areas?.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-slate-500 mb-1.5">Covered Areas</p>
                            <div className="flex flex-wrap gap-1">
                              {service.allowed_areas.map(a => (
                                <Badge key={a} variant="outline" className="text-xs">{a}</Badge>
                              ))}
                            </div>
                          </div>
                        )}

                        {service.requires_license_types?.length > 0 && (
                          <div className="flex items-center gap-1 text-xs text-slate-500">
                            <Award className="w-3.5 h-3.5" />
                            Requires: {service.requires_license_types.join(", ")}
                          </div>
                        )}

                        {service.scope_rules?.length > 0 && (
                          <div className="space-y-1">
                            {service.scope_rules.slice(0, 2).map((rule, i) => (
                              <div key={i} className="flex items-center gap-2 text-xs text-slate-600">
                                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                                {rule.rule_name}: {rule.rule_value} {rule.unit}
                              </div>
                            ))}
                          </div>
                        )}

                        {!isActive && (
                          <Button
                            size="sm"
                            className="w-full mt-1"
                            style={{ background: "#FA6F30", color: "#fff" }}
                            onClick={() => {
                              setSelectedServiceTypeId(service.id);
                              setActivateDialog(true);
                              resetActivation();
                            }}
                          >
                            Apply for Coverage
                          </Button>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </TabsContent>

        {/* MY ACTIVE COVERAGE TAB */}
        <TabsContent value="active" className="space-y-4 pt-4">
          {activeSubscriptions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center space-y-4">
                <Shield className="w-12 h-12 mx-auto text-slate-200" />
                <div>
                  <p className="font-semibold text-slate-700">No active coverage yet</p>
                  <p className="text-slate-400 text-sm mt-1">Apply for MD coverage to unlock full platform access</p>
                </div>
                <Button
                  onClick={() => { setActivateDialog(true); resetActivation(); }}
                  style={{ background: "#FA6F30", color: "#fff" }}
                >
                  Apply for Coverage
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeSubscriptions.map(sub => {
                const serviceType = serviceTypes.find(s => s.id === sub.service_type_id);
                return (
                  <Card key={sub.id} className="border-green-200">
                    <CardContent className="py-4">
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <CheckCircle2 className="w-5 h-5 text-green-500" />
                            <h4 className="font-semibold text-slate-900">{sub.service_type_name}</h4>
                          </div>
                          <p className="text-sm text-slate-500 ml-7">
                            ${mySubscriptions.filter(s => s.status === "active").findIndex(s => s.id === sub.id) === 0 ? FIRST_SERVICE_PRICE : ADDON_SERVICE_PRICE}/month
                          </p>
                          {sub.activated_at && (
                            <p className="text-xs text-slate-400 ml-7 mt-1">
                              Active since {format(new Date(sub.activated_at), "MMM d, yyyy")}
                            </p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                          <Link to={createPageUrl("ProviderProfile")}>
                            <Button size="sm" variant="outline" className="gap-1 text-xs h-7">
                              <DollarSign className="w-3 h-3" /> Set Pricing
                            </Button>
                          </Link>
                        </div>
                      </div>
                      {/* Protocol documents */}
                      {serviceType?.protocol_document_urls?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Your Protocols</p>
                          <div className="flex flex-wrap gap-2">
                            {serviceType.protocol_document_urls.map((doc, i) => (
                              <a key={i} href={doc.url} target="_blank" rel="noreferrer"
                                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-700 hover:bg-purple-100 transition-colors">
                                <FileText className="w-3 h-3" /> {doc.name}
                              </a>
                            ))}
                          </div>
                        </div>
                      )}
                      {/* Scope rules */}
                      {serviceType?.scope_rules?.length > 0 && (
                        <div className="mt-3 pt-3 border-t border-slate-100">
                          <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Scope of Practice</p>
                          <div className="grid sm:grid-cols-2 gap-1.5">
                            {serviceType.scope_rules.map((r, i) => (
                              <div key={i} className="text-xs bg-slate-50 rounded-lg px-3 py-1.5">
                                <span className="font-semibold text-slate-700">{r.rule_name}:</span>{" "}
                                <span className="text-slate-600">{r.rule_value} {r.unit}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}

              <div className="pt-2">
                <Button
                  variant="outline"
                  onClick={() => { setActivateDialog(true); resetActivation(); }}
                  className="gap-2"
                >
                  <Plus className="w-4 h-4" />
                  Add Another Service
                </Button>
              </div>
            </div>
          )}
        </TabsContent>

        {/* MD SUPERVISION TAB */}
        <TabsContent value="supervision" className="space-y-4 pt-4">
          <div className="flex items-center justify-between">
            <p className="text-slate-600 text-sm">Connect with a medical director to enable supervised practice.</p>
            <Button size="sm" variant="outline" onClick={() => setRequestDialog(true)} className="gap-2">
              <Plus className="w-4 h-4" />
              Request Supervisor
            </Button>
          </div>

          {pendingRelationships.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Pending Approval</p>
              {pendingRelationships.map(rel => (
                <Card key={rel.id}>
                  <CardContent className="py-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{rel.medical_director_name}</p>
                        <p className="text-sm text-slate-500">{rel.medical_director_email}</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">
                        <Clock className="w-3 h-3 mr-1" />
                        Pending
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeRelationships.length > 0 ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Active Supervision</p>
              {activeRelationships.map(rel => {
                const months = rel.start_date ? differenceInMonths(new Date(), new Date(rel.start_date)) : 0;
                return (
                  <Card key={rel.id} className="border-green-200">
                    <CardContent className="py-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-semibold text-slate-900">{rel.medical_director_name}</p>
                          <p className="text-sm text-slate-500">{rel.medical_director_email}</p>
                        </div>
                        <Badge className="bg-green-100 text-green-800">Active</Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <p className="text-slate-500">Since</p>
                          <p className="font-semibold">{rel.start_date ? format(new Date(rel.start_date), "MMM d, yyyy") : "N/A"}</p>
                        </div>
                        <div>
                          <p className="text-slate-500">Duration</p>
                          <p className="font-semibold">{months} months</p>
                        </div>
                      </div>
                      {rel.supervision_notes && (
                        <div className="bg-blue-50 rounded p-3 border border-blue-100 text-sm text-blue-800">
                          {rel.supervision_notes}
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            pendingRelationships.length === 0 && (
              <Card>
                <CardContent className="py-8 text-center">
                  <Shield className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                  <p className="text-slate-400 text-sm">No medical director connections yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setRequestDialog(true)}>
                    Connect with an MD
                  </Button>
                </CardContent>
              </Card>
            )
          )}
        </TabsContent>
      </Tabs>

      {/* ACTIVATION DIALOG */}
      <Dialog open={activateDialog} onOpenChange={(v) => { if (!v) resetActivation(); setActivateDialog(v); }}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Apply for MD Coverage</DialogTitle>
          </DialogHeader>

          {/* Step indicator */}
          <div className="flex items-center gap-2 py-1">
            {ACTIVATION_STEPS.map((label, i) => (
              <div key={i} className="flex items-center gap-1.5 flex-1">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0
                  ${i < step ? "bg-green-500 text-white" : i === step ? "text-[#1A1A2E]" : "bg-slate-100 text-slate-400"}`}
                  style={i === step ? { background: "var(--novi-gold)" } : {}}>
                  {i < step ? <CheckCircle className="w-3.5 h-3.5" /> : i + 1}
                </div>
                <span className={`text-xs font-medium hidden sm:block ${i <= step ? "text-slate-800" : "text-slate-400"}`}>{label}</span>
                {i < ACTIVATION_STEPS.length - 1 && <ChevronRight className="w-3.5 h-3.5 text-slate-300 flex-shrink-0 ml-auto" />}
              </div>
            ))}
          </div>

          {/* Step 0 */}
          {step === 0 && (
            <div className="space-y-4">
              <div className="flex gap-3">
                <button
                  onClick={() => setUseExternalCert(false)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${!useExternalCert ? "border-[#C9A96E] bg-amber-50 text-amber-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                >
                  <KeyRound className="w-4 h-4 mb-1" />
                  NOVI Class Code
                  <p className="text-xs font-normal mt-0.5 text-slate-500">Attended a NOVI course? Enter your class code.</p>
                </button>
                <button
                  onClick={() => setUseExternalCert(true)}
                  className={`flex-1 py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all text-left ${useExternalCert ? "border-[#C9A96E] bg-amber-50 text-amber-900" : "border-slate-200 text-slate-500 hover:border-slate-300"}`}
                >
                  <Award className="w-4 h-4 mb-1" />
                  External Certification
                  <p className="text-xs font-normal mt-0.5 text-slate-500">Certified elsewhere? Upload your cert.</p>
                </button>
              </div>

              {!useExternalCert ? (
                <div className="space-y-3">
                  {myEnrollments.length === 0 ? (
                    // No enrollment at all — prompt to purchase a course
                    <div className="text-center space-y-4 py-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(201,169,110,0.15)" }}>
                        <BookOpen className="w-6 h-6" style={{ color: "var(--novi-gold)" }} />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">No NOVI Course Purchased</p>
                        <p className="text-sm text-slate-500 mt-1">You need to enroll in a NOVI course first before applying for MD coverage.</p>
                      </div>
                      <Button
                        className="w-full"
                        style={{ background: "#FA6F30", color: "#fff" }}
                        onClick={() => {
                          setActivateDialog(false);
                          window.location.href = "/CourseCatalog";
                        }}
                      >
                        Browse & Purchase a Course
                      </Button>
                    </div>
                  ) : !hasTodayClass ? (
                    // Has enrollment but class is not today
                    <div className="text-center space-y-4 py-4">
                      <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto bg-blue-50">
                        <Calendar className="w-6 h-6 text-blue-500" />
                      </div>
                      <div>
                        <p className="font-semibold text-slate-900">Class Not Today</p>
                        <p className="text-sm text-slate-500 mt-1">Your class code will be available here on the day of your scheduled class. Check back then!</p>
                      </div>
                      <div className="bg-slate-50 rounded-xl p-4 text-left space-y-2">
                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Your Upcoming Classes</p>
                        {myEnrollments
                          .filter(e => e.session_date && (e.status === "confirmed" || e.status === "paid"))
                          .map(e => (
                            <div key={e.id} className="flex items-center justify-between text-sm">
                              <span className="text-slate-700 font-medium">{e.course_title || "Course"}</span>
                              <span className="text-slate-500">{e.session_date ? format(new Date(e.session_date), "MMM d, yyyy") : "TBD"}</span>
                            </div>
                          ))}
                      </div>
                    </div>
                  ) : (
                    // Has a class TODAY — show the code input
                    <div className="space-y-3">
                      <div className="bg-green-50 border border-green-200 rounded-lg p-3 text-sm text-green-800">
                        🎉 You have a class today! Enter the code your instructor provides at the end of class.
                      </div>
                      <Input
                        placeholder="Enter class code..."
                        value={classCode}
                        onChange={e => { setClassCode(e.target.value.toUpperCase()); setCodeError(""); }}
                        className="text-lg font-mono tracking-widest text-center"
                      />
                      {codeError && <p className="text-sm text-red-500">{codeError}</p>}
                      <Button
                        onClick={() => verifyCodeMutation.mutate()}
                        disabled={!classCode || verifyCodeMutation.isPending}
                        className="w-full"
                        style={{ background: "#FA6F30", color: "#fff" }}
                      >
                        {verifyCodeMutation.isPending ? "Verifying..." : "Verify Code"}
                      </Button>
                    </div>
                  )}
                </div>
              ) : certSubmitted ? (
                <div className="border border-green-200 bg-green-50 rounded-xl p-6 text-center">
                  <CheckCircle className="w-10 h-10 text-green-500 mx-auto mb-2" />
                  <p className="font-bold text-green-800">Certification Submitted!</p>
                  <p className="text-green-700 text-sm mt-1">Our team will review and activate your account.</p>
                </div>
              ) : (
                <div className="space-y-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Certification Name *</label>
                      <Input value={certForm.cert_name} onChange={e => setCertForm(f => ({ ...f, cert_name: e.target.value }))} placeholder="e.g. Botox Certification" />
                    </div>
                    <div>
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">Issuing School *</label>
                      <Input value={certForm.issuing_school} onChange={e => setCertForm(f => ({ ...f, issuing_school: e.target.value }))} placeholder="e.g. ABC Aesthetics" />
                    </div>
                    <div className="col-span-2">
                      <label className="text-xs font-semibold text-slate-600 mb-1 block">License Type</label>
                      <div className="flex flex-wrap gap-2">
                        {CERT_TYPES.map(t => (
                          <button key={t} onClick={() => setCertForm(f => ({ ...f, cert_type: t }))}
                            className={`px-3 py-1 rounded-full text-xs font-medium border transition-all ${certForm.cert_type === t ? "border-[#C9A96E] bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600"}`}>
                            {t}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                  <label className="flex items-center gap-2 cursor-pointer border-2 border-dashed rounded-lg p-4 hover:bg-slate-50">
                    <Upload className="w-4 h-4 text-slate-400" />
                    <span className="text-sm text-slate-500">
                      {uploadingCert ? "Uploading..." : certFileUrl ? "Certificate uploaded ✓" : "Upload PDF or image"}
                    </span>
                    <input type="file" className="hidden" accept=".pdf,.jpg,.jpeg,.png" onChange={uploadCertFile} />
                  </label>
                  <Button
                    onClick={() => submitExternalCertMutation.mutate()}
                    disabled={!certForm.cert_name || !certForm.issuing_school || !certFileUrl || submitExternalCertMutation.isPending}
                    className="w-full"
                    style={{ background: "#FA6F30", color: "#fff" }}
                  >
                    {submitExternalCertMutation.isPending ? "Submitting..." : "Submit for Review"}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Step 1 */}
          {step === 1 && (
            <div className="space-y-3">
              <p className="text-sm text-slate-500">Select the service you want to activate MD coverage for.</p>
              {availableServices.length === 0 && alreadyActiveServices.length > 0 ? (
                <p className="text-sm text-slate-400 py-4 text-center">All eligible services are already activated.</p>
              ) : availableServices.length === 0 ? (
                <div className="text-center space-y-4 py-4">
                  <div className="w-12 h-12 rounded-full flex items-center justify-center mx-auto" style={{ background: "rgba(201,169,110,0.15)" }}>
                    <BookOpen className="w-6 h-6" style={{ color: "var(--novi-gold)" }} />
                  </div>
                  <div>
                    <p className="font-semibold text-slate-900">No Eligible Services Yet</p>
                    <p className="text-sm text-slate-500 mt-1">You need to complete a NOVI course before you can activate MD coverage for a service. Each course unlocks the specific services it covers.</p>
                  </div>
                  <Button
                    className="w-full"
                    style={{ background: "#FA6F30", color: "#fff" }}
                    onClick={() => {
                      setActivateDialog(false);
                      window.location.href = "/CourseCatalog";
                    }}
                  >
                    Browse Courses
                  </Button>
                </div>
              ) : (
                availableServices.map(s => (
                  <div
                    key={s.id}
                    onClick={() => setSelectedServiceTypeId(s.id)}
                    className={`border-2 rounded-xl p-4 cursor-pointer transition-all ${selectedServiceTypeId === s.id ? "border-[#C9A96E] bg-amber-50" : "border-slate-100 hover:border-slate-300"}`}
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-slate-900">{s.name}</p>
                        <p className="text-xs text-slate-500 capitalize">{s.category?.replace("_", " ")}</p>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="text-right">
                          <span className="font-bold text-slate-900">${getMembershipPrice()}</span>
                          <span className="text-xs text-slate-400">/mo</span>
                        </div>
                        {selectedServiceTypeId === s.id && <CheckCircle className="w-5 h-5 text-[#C9A96E]" />}
                      </div>
                    </div>
                  </div>
                ))
              )}
              <Button
                onClick={() => setStep(2)}
                disabled={!selectedServiceTypeId}
                className="w-full"
                style={{ background: "#FA6F30", color: "#fff" }}
              >
                Continue to Sign Agreement
              </Button>
            </div>
          )}

          {/* Step 2 */}
          {step === 2 && (
            <div className="space-y-4">
              {/* Pricing summary */}
              <div className="rounded-xl border-2 p-4 flex items-center justify-between" style={{ borderColor: "var(--novi-gold)", background: "rgba(201,169,110,0.06)" }}>
                <div>
                  <p className="font-semibold text-slate-900">{selectedService?.name} — MD Coverage</p>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {alreadyActiveServices.length === 0 ? "First service membership" : "Add-on service membership"}
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-bold" style={{ color: "var(--novi-dark)" }}>${getMembershipPrice()}</p>
                  <p className="text-xs text-slate-400">/month</p>
                </div>
              </div>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 max-h-40 overflow-y-auto text-sm text-slate-700 leading-relaxed">
                {selectedService?.md_agreement_text ||
                  `By signing below, I acknowledge that I have completed the required NOVI training for ${selectedService?.name}, agree to operate within the approved service scope and protocols, and accept medical director supervision as required by my state's regulations.`}
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 mb-2 uppercase tracking-wide">Your Signature</p>
                <div className="border-2 border-dashed border-slate-300 rounded-xl overflow-hidden bg-white relative">
                  <canvas
                    ref={canvasRef}
                    width={520}
                    height={120}
                    className="w-full touch-none cursor-crosshair"
                    onMouseDown={startDraw}
                    onMouseMove={draw}
                    onMouseUp={endDraw}
                    onMouseLeave={endDraw}
                    onTouchStart={startDraw}
                    onTouchMove={draw}
                    onTouchEnd={endDraw}
                  />
                  {!hasSigned && (
                    <p className="absolute inset-0 flex items-center justify-center text-slate-300 text-sm pointer-events-none">Sign here</p>
                  )}
                </div>
                <Button variant="ghost" size="sm" onClick={clearSignature} className="mt-1 text-slate-400">
                  <RotateCcw className="w-3.5 h-3.5 mr-1" /> Clear
                </Button>
              </div>
              <div className="flex items-center gap-2 text-xs text-slate-500 bg-slate-50 rounded-lg p-3">
                <CheckCircle className="w-3.5 h-3.5 text-green-500 flex-shrink-0" />
                Signing as <strong className="mx-1">{me?.full_name}</strong> · {format(new Date(), "MMMM d, yyyy")}
              </div>
              <Button
                onClick={() => activateMutation.mutate()}
                disabled={!hasSigned || activateMutation.isPending}
                className="w-full"
                style={{ background: "#2d3d66", color: "white" }}
              >
                {activateMutation.isPending ? "Activating..." : "Sign & Activate MD Coverage"}
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Request MD Dialog */}
      <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Request Medical Director Supervision</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="relative">
              <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
              <Input
                placeholder="Search by name or email..."
                value={searchEmail}
                onChange={(e) => setSearchEmail(e.target.value)}
                className="pl-9"
              />
            </div>
            {searchEmail && filteredMDs.length > 0 ? (
              <div className="space-y-2 max-h-64 overflow-y-auto">
                {filteredMDs.map(md => (
                  <button
                    key={md.id}
                    onClick={() => requestRelationshipMutation.mutate(md.id)}
                    className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                  >
                    <p className="font-semibold text-slate-900">{md.full_name}</p>
                    <p className="text-sm text-slate-500">{md.email}</p>
                  </button>
                ))}
              </div>
            ) : searchEmail ? (
              <p className="text-sm text-slate-500 text-center py-4">No available medical directors found.</p>
            ) : (
              <p className="text-sm text-slate-500 text-center py-4">Start typing to search for medical directors.</p>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRequestDialog(false)}>Cancel</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}