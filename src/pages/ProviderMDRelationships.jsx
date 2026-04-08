import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Textarea } from "@/components/ui/textarea";
import { Shield, Clock, CheckCircle2, AlertTriangle, Search, Plus, Calendar } from "lucide-react";
import { format, differenceInMonths } from "date-fns";
import ProviderLockGate from "@/components/ProviderLockGate";

const statusConfig = {
  pending: { label: "Awaiting Approval", color: "bg-yellow-100 text-yellow-800", icon: Clock },
  active: { label: "Active", color: "bg-green-100 text-green-800", icon: CheckCircle2 },
  suspended: { label: "Suspended", color: "bg-red-100 text-red-800", icon: AlertTriangle },
  terminated: { label: "Terminated", color: "bg-slate-100 text-slate-800" },
};

export default function ProviderMDRelationships() {
  const [requestDialog, setRequestDialog] = useState(false);
  const [searchEmail, setSearchEmail] = useState("");
  const [notes, setNotes] = useState("");
  const queryClient = useQueryClient();

  const { data: me } = useQuery({
    queryKey: ["me"],
    queryFn: () => base44.auth.me(),
  });

  const { data: relationships = [] } = useQuery({
    queryKey: ["my-md-relationships"],
    queryFn: async () => {
      if (!me) return [];
      return base44.entities.MedicalDirectorRelationship.filter({
        provider_id: me.id,
      });
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
      setNotes("");
    },
  });

  const filteredMDs = medicalDirectors.filter(md =>
    md.email.toLowerCase().includes(searchEmail.toLowerCase()) ||
    md.full_name.toLowerCase().includes(searchEmail.toLowerCase())
  );

  const existingMDIds = relationships.map(r => r.medical_director_id);
  const availableMDs = filteredMDs.filter(md => !existingMDIds.includes(md.id));

  const pendingRelationships = relationships.filter(r => r.status === "pending");
  const activeRelationships = relationships.filter(r => r.status === "active");
  const suspendedRelationships = relationships.filter(r => r.status === "suspended");

  return (
    <ProviderLockGate>
      <div className="space-y-6 max-w-5xl">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-2xl font-bold text-slate-900">Medical Director Supervision</h2>
            <p className="text-slate-500 text-sm mt-1">
              Request and manage supervision relationships with medical directors
            </p>
          </div>
          <Button
            onClick={() => setRequestDialog(true)}
            className="gap-2"
          >
            <Plus className="w-4 h-4" />
            Request Supervisor
          </Button>
        </div>

        {/* Pending Requests */}
        {pendingRelationships.length > 0 && (
          <div className="space-y-4">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Pending Approval
            </h3>
            <div className="space-y-3">
              {pendingRelationships.map(rel => (
                <Card key={rel.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <h4 className="font-semibold text-slate-900">{rel.medical_director_name}</h4>
                        <p className="text-sm text-slate-500">{rel.medical_director_email}</p>
                        <p className="text-sm text-slate-600 mt-2">Waiting for approval...</p>
                      </div>
                      <Badge className="bg-yellow-100 text-yellow-800">Pending</Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}

        {/* Suspended */}
        {suspendedRelationships.length > 0 && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription>
              You have {suspendedRelationships.length} suspended supervision relationship(s). Contact your medical director or request a new supervisor.
            </AlertDescription>
          </Alert>
        )}

        {/* Active Relationships */}
        <div className="space-y-4">
          <h3 className="font-semibold text-slate-900 flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Active Supervision ({activeRelationships.length})
          </h3>

          {activeRelationships.length === 0 ? (
            <Card>
              <CardContent className="py-8 text-center">
                <Shield className="w-10 h-10 mx-auto text-slate-200 mb-3" />
                <p className="text-slate-400 mb-4">No active medical director relationships yet.</p>
                <Button onClick={() => setRequestDialog(true)} variant="outline">
                  Request a Medical Director
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              {activeRelationships.map(rel => {
                const monthsSupervised = rel.start_date
                  ? differenceInMonths(new Date(), new Date(rel.start_date))
                  : 0;

                return (
                  <Card key={rel.id}>
                    <CardContent className="py-4">
                      <div className="space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900">{rel.medical_director_name}</h4>
                            <p className="text-sm text-slate-500">{rel.medical_director_email}</p>
                          </div>
                          <Badge className="bg-green-100 text-green-800">Active</Badge>
                        </div>

                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="text-slate-500">Supervision Since</p>
                            <p className="font-semibold text-slate-900">
                              {rel.start_date ? format(new Date(rel.start_date), "MMM d, yyyy") : "N/A"}
                            </p>
                          </div>
                          <div>
                            <p className="text-slate-500">Duration</p>
                            <p className="font-semibold text-slate-900">{monthsSupervised} months</p>
                          </div>
                        </div>

                        {rel.supervision_notes && (
                          <div className="bg-blue-50 rounded p-3 border border-blue-200">
                            <p className="text-xs text-blue-900 font-medium mb-1">Supervisor Notes</p>
                            <p className="text-sm text-blue-800">{rel.supervision_notes}</p>
                          </div>
                        )}

                        {rel.last_review_date && (
                          <div className="flex items-center gap-2 text-sm text-slate-600">
                            <Calendar className="w-4 h-4" />
                            Last review: {format(new Date(rel.last_review_date), "MMM d, yyyy")}
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Request Dialog */}
        <Dialog open={requestDialog} onOpenChange={setRequestDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Request Medical Director Supervision</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div>
                <label className="text-sm font-medium text-slate-700 block mb-2">
                  Search Medical Directors
                </label>
                <div className="relative">
                  <Search className="absolute left-3 top-2.5 w-4 h-4 text-slate-400" />
                  <Input
                    placeholder="Search by name or email..."
                    value={searchEmail}
                    onChange={(e) => setSearchEmail(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>

              {searchEmail && availableMDs.length > 0 ? (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {availableMDs.map(md => (
                    <button
                      key={md.id}
                      onClick={() => {
                        requestRelationshipMutation.mutate(md.id);
                      }}
                      className="w-full text-left p-3 rounded-lg border border-slate-200 hover:bg-slate-50 transition-colors"
                    >
                      <p className="font-semibold text-slate-900">{md.full_name}</p>
                      <p className="text-sm text-slate-500">{md.email}</p>
                    </button>
                  ))}
                </div>
              ) : searchEmail ? (
                <p className="text-sm text-slate-500 text-center py-4">
                  No available medical directors found.
                </p>
              ) : (
                <p className="text-sm text-slate-500 text-center py-4">
                  Start typing to search for medical directors.
                </p>
              )}
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => setRequestDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </ProviderLockGate>
  );
}