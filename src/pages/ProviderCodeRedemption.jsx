import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { base44 } from "@/api/base44Client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { BookOpen, CheckCircle, AlertCircle, Loader, Shield } from "lucide-react";
import { format } from "date-fns";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import ProviderLockGate from "@/components/ProviderLockGate";

export default function ProviderCodeRedemption() {
  const queryClient = useQueryClient();
  const [code, setCode] = useState("");
  const [successDialog, setSuccessDialog] = useState(null);
  const [error, setError] = useState("");

  const { data: myEnrollments = [] } = useQuery({
    queryKey: ["my-enrollments"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.Enrollment.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["my-sessions"],
    queryFn: async () => {
      const me = await base44.auth.me();
      return base44.entities.ClassSession.filter({ provider_id: me.id }, "-created_date");
    },
  });

  const { data: courses = [] } = useQuery({
    queryKey: ["courses"],
    queryFn: () => base44.entities.Course.list(),
  });

  const redeemMutation = useMutation({
    mutationFn: (sessionCode) =>
      base44.functions.invoke("redeemClassCode", { session_code: sessionCode }),
    onSuccess: (res) => {
      if (res.data.success) {
        setSuccessDialog(res.data);
        setCode("");
        queryClient.invalidateQueries({ queryKey: ["my-sessions"] });
        queryClient.invalidateQueries({ queryKey: ["my-enrollments"] });
        setError("");
      } else {
        setError(res.data.error || "Failed to redeem code");
      }
    },
    onError: (err) => {
      setError(err.message || "An error occurred");
    },
  });

  const courseMap = Object.fromEntries(courses.map(c => [c.id, c]));
  const redeemed = sessions.filter(s => s.code_used);

  return (
    <ProviderLockGate feature="attendance">
      <div className="space-y-6 max-w-2xl">
        <div>
          <h2 className="text-2xl font-bold text-slate-900">Class Attendance</h2>
          <p className="text-slate-500 text-sm mt-1">Enter your class code to confirm attendance</p>
        </div>

        {/* Code Entry Card */}
        <Card className="border-2 border-amber-200 bg-amber-50/30">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <BookOpen className="w-5 h-5 text-amber-600" />
              Redeem Attendance Code
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="w-4 h-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <div>
              <label className="text-sm font-semibold text-slate-700 block mb-2">
                Enter the 6-character code from your instructor:
              </label>
              <div className="flex gap-2">
                <Input
                  placeholder="E.g., ABC123"
                  value={code}
                  onChange={(e) => setCode(e.target.value.toUpperCase())}
                  maxLength="6"
                  className="font-mono text-lg tracking-widest text-center uppercase"
                />
                <Button
                  onClick={() => redeemMutation.mutate(code)}
                  disabled={code.length !== 6 || redeemMutation.isPending}
                  style={{ background: "#FA6F30", color: "#fff" }}
                >
                  {redeemMutation.isPending ? (
                    <Loader className="w-4 h-4 animate-spin" />
                  ) : (
                    "Submit"
                  )}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Success Dialog */}
        <Dialog open={!!successDialog} onOpenChange={() => setSuccessDialog(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                Attendance Confirmed!
              </DialogTitle>
            </DialogHeader>
            {successDialog && (
              <div className="space-y-4 pt-4">
                <div className="bg-green-50 rounded-lg p-4 space-y-2">
                  <p className="text-sm text-slate-700">
                    <strong>Course:</strong> {successDialog.course_title}
                  </p>
                  <p className="text-sm text-slate-700">
                    <strong>Session:</strong> {format(new Date(successDialog.session_date), "MMM d, yyyy")}
                  </p>
                  {successDialog.certifications?.length > 0 && (
                    <div className="pt-2 border-t border-green-200">
                      <p className="text-sm font-semibold text-slate-700 mb-2">Certifications Awarded:</p>
                      <div className="space-y-1">
                        {successDialog.certifications.map((cert, i) => (
                          <div key={i} className="flex items-center gap-2 text-sm">
                            <CheckCircle className="w-4 h-4 text-green-600" />
                            <span className="text-slate-700">{cert}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
                <Link to={createPageUrl("ProviderCredentialsCoverage")} className="block">
                  <Button className="w-full" style={{ background: "#FA6F30", color: "#fff" }}>
                    <Shield className="w-4 h-4 mr-2" /> Activate MD Coverage
                  </Button>
                </Link>
                <Button variant="outline" className="w-full" onClick={() => setSuccessDialog(null)}>
                  Do this later
                </Button>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Redeemed Sessions */}
        {redeemed.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Your Confirmed Attendance</h3>
            {redeemed.map((session) => (
              <Card key={session.id} className="border-l-4 border-l-green-500">
                <CardContent className="pt-4">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="font-semibold text-slate-900">{session.course_title}</p>
                      <p className="text-sm text-slate-500 mt-1">
                        {format(new Date(session.session_date), "MMM d, yyyy")}
                      </p>
                    </div>
                    <Badge className="bg-green-100 text-green-700">
                      <CheckCircle className="w-3 h-3 mr-1" />
                      Attended
                    </Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Enrolled Courses (not attended) */}
        {myEnrollments.length > 0 && (
          <div className="space-y-3">
            <h3 className="font-semibold text-slate-900">Upcoming/Active Enrollments</h3>
            <div className="space-y-2">
              {myEnrollments
                .filter((e) => !sessions.some((s) => s.enrollment_id === e.id && s.code_used))
                .map((enrollment) => (
                  <Card key={enrollment.id}>
                    <CardContent className="pt-4">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="font-medium text-slate-900">
                            {courseMap[enrollment.course_id]?.title || "Course"}
                          </p>
                          <p className="text-xs text-slate-500 mt-1">
                            <Badge variant="secondary">{enrollment.status}</Badge>
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
            </div>
          </div>
        )}
      </div>
    </ProviderLockGate>
  );
}