import { Calendar, Users, TrendingUp, Shield, CheckCircle, Activity, Zap, Award, Eye, Brain, DollarSign, Clock, Star } from "lucide-react";

export default function AppPreviewMockup({ view = "dashboard" }) {
  const views = {
    dashboard: (
      <div className="relative rounded-xl overflow-hidden bg-white" style={{ 
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 10px 40px rgba(0,0,0,0.04)"
      }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#334155", fontStyle: "italic", fontWeight: 500 }}>novi</span>
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-600">Dashboard</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-green-600 font-medium flex items-center gap-1">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              Live
            </span>
            <div className="w-7 h-7 rounded-full bg-gradient-to-br from-slate-400 to-slate-600" />
          </div>
        </div>
        
        <div className="p-5">
          {/* Stats Grid */}
          <div className="grid grid-cols-4 gap-3.5 mb-5">
            <div className="group">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Users className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Patients</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-0.5">2,847</p>
              <p className="text-xs text-emerald-600">↑ 34% vs last month</p>
            </div>
            
            <div className="group">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Calendar className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">This Week</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-0.5">38</p>
              <p className="text-xs text-slate-600">$42,650 revenue</p>
            </div>
            
            <div className="group">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Star className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Rating</span>
              </div>
              <div className="flex items-baseline gap-1 mb-0.5">
                <p className="text-2xl font-bold text-slate-900">4.94</p>
                <span className="text-amber-400 text-sm">★</span>
              </div>
              <p className="text-xs text-slate-600">1,847 reviews</p>
            </div>
            
            <div className="group">
              <div className="flex items-center gap-1.5 mb-1.5">
                <Shield className="w-3.5 h-3.5 text-slate-500" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Compliance</span>
              </div>
              <p className="text-2xl font-bold text-slate-900 mb-0.5">100%</p>
              <p className="text-xs text-emerald-600 flex items-center gap-1">
                <CheckCircle className="w-3 h-3" /> Active
              </p>
            </div>
          </div>

          {/* Schedule */}
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
                <Calendar className="w-4 h-4 text-slate-700" />
                Today's Schedule
              </h3>
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Zap className="w-3 h-3" /> AI-optimized
              </span>
            </div>
            
            <div className="space-y-2.5">
              {[
                { time: "9:30", patient: "Sarah Martinez", tx: "Lip Enhancement", product: "Juvéderm 1.5mL", amt: "$875", match: 98, status: "confirmed" },
                { time: "11:00", patient: "Emily Chen", tx: "Botox Treatment", product: "Glabella + Forehead", amt: "$650", match: 96, status: "confirmed" },
                { time: "14:00", patient: "Jessica Park", tx: "Cheek Augmentation", product: "Restylane", amt: "$1,200", match: 94, status: "pending" }
              ].map((apt, i) => (
                <div key={i} className="group relative">
                  <div className="flex items-center gap-3 p-3 rounded-lg border border-gray-200 hover:border-slate-300 transition-colors bg-white">
                    {/* Time */}
                    <div className="flex flex-col items-center justify-center w-12">
                      <span className="text-sm font-semibold text-slate-700">{apt.time}</span>
                      <span className="text-xs text-slate-400">AM</span>
                    </div>

                    {/* Avatar with match score */}
                    <div className="relative">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex items-center justify-center text-white text-xs font-semibold">
                        {apt.patient.split(' ').map(n => n[0]).join('')}
                      </div>
                      <div className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-white border-2 border-white shadow-sm flex items-center justify-center">
                        <span className="text-[10px] font-bold text-blue-600">{apt.match}</span>
                      </div>
                    </div>

                    {/* Details */}
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-sm text-slate-900 truncate">{apt.patient}</p>
                      <p className="text-xs text-slate-600 truncate">{apt.tx} · {apt.product}</p>
                    </div>

                    {/* Revenue & Status */}
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        <p className="text-sm font-semibold text-slate-900">{apt.amt}</p>
                        <p className="text-xs text-slate-500">{apt.match}% match</p>
                      </div>
                      <div className={`px-3 py-1.5 rounded-md text-xs font-medium ${
                        apt.status === 'confirmed' 
                          ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' 
                          : 'bg-amber-50 text-amber-700 border border-amber-100'
                      }`}>
                        {apt.status === 'confirmed' ? 'Confirmed' : 'Pending'}
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Metrics */}
          <div className="grid grid-cols-3 gap-2.5 mt-4 pt-4 border-t border-gray-100">
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">87%</p>
              <p className="text-xs text-slate-500">Retention rate</p>
            </div>
            <div className="text-center border-x border-gray-100">
              <p className="text-lg font-bold text-slate-900">12hrs</p>
              <p className="text-xs text-slate-500">Avg booking time</p>
            </div>
            <div className="text-center">
              <p className="text-lg font-bold text-slate-900">2.4</p>
              <p className="text-xs text-slate-500">Visits per patient</p>
            </div>
          </div>
        </div>
      </div>
    ),
    
    patient: (
      <div className="relative rounded-xl overflow-hidden bg-white" style={{ 
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 10px 40px rgba(0,0,0,0.04)"
      }}>
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#334155", fontStyle: "italic", fontWeight: 500 }}>novi</span>
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-600">Your Journey</span>
          </div>
        </div>
        
        <div className="p-5">
          {/* AI Analysis Result */}
          <div className="mb-5 p-4 rounded-lg bg-gradient-to-br from-emerald-50 via-white to-white border border-emerald-100">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-lg bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <Brain className="w-5 h-5 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-xs font-semibold text-emerald-700 uppercase tracking-wide">Analysis Complete</span>
                  <span className="px-2 py-0.5 rounded bg-emerald-600 text-white text-xs font-bold">98% Match</span>
                </div>
                <h4 className="font-semibold text-slate-900 text-sm mb-1.5">Lip Enhancement Recommended</h4>
                <p className="text-xs text-slate-600 leading-relaxed mb-2">
                  Subtle lip augmentation would create natural balance while maintaining your unique facial proportions and aesthetic preferences.
                </p>
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <CheckCircle className="w-3 h-3 text-emerald-600" /> Natural results
                  </span>
                  <span className="inline-flex items-center gap-1 text-slate-600">
                    <CheckCircle className="w-3 h-3 text-emerald-600" /> 3-5 day recovery
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Provider Cards */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-slate-700" />
              Top Matched Providers
            </h3>
            
            <div className="space-y-2.5">
              {[
                { name: "Dr. Sarah Thompson, MD", spec: "Board Certified Dermatology", dist: "2.1 mi", rating: 4.96, reviews: 847, price: "$850-1200" },
                { name: "Jessica Martinez, NP", spec: "Advanced Aesthetics · 12 years", dist: "3.4 mi", rating: 4.94, reviews: 623, price: "$750-1100" }
              ].map((p, i) => (
                <div key={i} className="flex items-center gap-3 p-3.5 rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm transition-all bg-white">
                  <div className="w-11 h-11 rounded-full bg-gradient-to-br from-blue-400 to-blue-600 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-slate-900 truncate">{p.name}</p>
                    <p className="text-xs text-slate-600 mb-1 truncate">{p.spec}</p>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 text-amber-400 fill-amber-400" />
                        {p.rating}
                      </span>
                      <span>·</span>
                      <span>{p.reviews} reviews</span>
                      <span>·</span>
                      <span>{p.dist}</span>
                    </div>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs font-medium text-slate-700 mb-1">{p.price}</p>
                    <button className="px-3 py-1.5 rounded-md bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors">
                      Book
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Features */}
          <div className="grid grid-cols-2 gap-2.5 mt-4 pt-4 border-t border-gray-100">
            <div className="p-3 rounded-lg bg-blue-50/50 border border-blue-100">
              <Eye className="w-4 h-4 text-blue-600 mb-1.5" />
              <p className="text-xs font-medium text-slate-900">Visual Previews</p>
              <p className="text-xs text-slate-500 mt-0.5">See results before booking</p>
            </div>
            <div className="p-3 rounded-lg bg-purple-50/50 border border-purple-100">
              <Award className="w-4 h-4 text-purple-600 mb-1.5" />
              <p className="text-xs font-medium text-slate-900">Verified Only</p>
              <p className="text-xs text-slate-500 mt-0.5">All credentials checked</p>
            </div>
          </div>
        </div>
      </div>
    ),

    compliance: (
      <div className="relative rounded-xl overflow-hidden bg-white" style={{ 
        boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 10px 40px rgba(0,0,0,0.04)"
      }}>
        <div className="flex items-center justify-between px-5 py-3.5 bg-gray-50/80 backdrop-blur-sm border-b border-gray-100">
          <div className="flex items-center gap-2.5">
            <span style={{ fontFamily: "'DM Serif Display', serif", fontSize: 16, color: "#334155", fontStyle: "italic", fontWeight: 500 }}>novi</span>
            <div className="w-1 h-1 rounded-full bg-gray-300" />
            <span className="text-sm text-gray-600">MD Oversight</span>
          </div>
        </div>
        
        <div className="p-5">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-3 mb-5">
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Reviewed</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">127</p>
              <p className="text-xs text-slate-600">This month</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Shield className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Compliance</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">100%</p>
              <p className="text-xs text-slate-600">Within scope</p>
            </div>
            <div>
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="w-3.5 h-3.5 text-amber-600" />
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">Avg Time</span>
              </div>
              <p className="text-2xl font-bold text-slate-900">2.1h</p>
              <p className="text-xs text-slate-600">Per review</p>
            </div>
          </div>

          {/* Activity Feed */}
          <div>
            <h3 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
              <Activity className="w-4 h-4 text-slate-700" />
              Recent Activity
            </h3>
            <div className="space-y-2">
              {[
                { provider: "Sarah Thompson, NP", action: "Lip filler approved", time: "12m ago" },
                { provider: "Emily Chen, RN", action: "Chart reviewed", time: "1h ago" },
                { provider: "Jessica Park, PA", action: "Scope verified", time: "3h ago" }
              ].map((activity, i) => (
                <div key={i} className="flex items-center gap-3 p-3 rounded-lg bg-gray-50 border border-gray-100">
                  <div className="w-7 h-7 rounded-full bg-emerald-100 flex items-center justify-center flex-shrink-0">
                    <CheckCircle className="w-4 h-4 text-emerald-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-slate-900 truncate">{activity.provider}</p>
                    <p className="text-xs text-slate-600">{activity.action}</p>
                  </div>
                  <span className="text-xs text-slate-400 whitespace-nowrap">{activity.time}</span>
                </div>
              ))}
            </div>
          </div>

          {/* System Features */}
          <div className="mt-4 pt-4 border-t border-gray-100">
            <p className="text-xs font-semibold text-slate-900 mb-2">Automated Systems</p>
            <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-xs text-slate-600">
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500" />
                Real-time monitoring
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500" />
                Scope verification
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500" />
                Complete audit trail
              </div>
              <div className="flex items-center gap-1.5">
                <div className="w-1 h-1 rounded-full bg-blue-500" />
                Risk assessment
              </div>
            </div>
          </div>
        </div>
      </div>
    ),
  };

  return views[view] || views.dashboard;
}