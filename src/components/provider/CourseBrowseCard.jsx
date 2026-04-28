import { Clock, MapPin, Award } from "lucide-react";

const categoryMeta = {
  botox: { color: "#DA6A63", image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1000&q=80" },
  fillers: { color: "#C8E63C", image: "https://images.unsplash.com/photo-1631390012074-8ba0f5c2e14d?w=1000&q=80" },
  laser: { color: "#7B8EC8", image: "https://images.unsplash.com/photo-1612817288484-6f916006741a?w=1000&q=80" },
  prp: { color: "#2D6B7F", image: "https://images.unsplash.com/photo-1576091160399-112ba8d25d1d?w=1000&q=80" },
  chemical_peel: { color: "#5a7a20", image: "https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=1000&q=80" },
  microneedling: { color: "#7B8EC8", image: "https://images.unsplash.com/photo-1576091160550-2173dba999ef?w=1000&q=80" },
  kybella: { color: "#FA6F30", image: "https://images.unsplash.com/photo-1559827260-dc66d52bef19?w=1000&q=80" },
  skincare: { color: "#4a6db8", image: "https://images.unsplash.com/photo-1556228578-8c89e6adf883?w=1000&q=80" },
  other: { color: "#1e2535", image: "https://images.unsplash.com/photo-1487412947147-5cebf100ffc2?w=1000&q=80" },
};

export default function CourseBrowseCard({ course, isEnrolled, onSelect }) {
  const meta = categoryMeta[course?.category] || categoryMeta.other;
  const heroImage = course.cover_image_url || meta.image;
  const nextDate = course.session_dates?.find(d => d.date)?.date;
  const seatsLeft = course.available_seats ?? course.max_seats;
  const hasSeatLimit = course.available_seats !== null && course.available_seats !== undefined;
  const isFull = hasSeatLimit && Number(course.available_seats) <= 0;

  return (
    <div
      onClick={() => !isEnrolled && !isFull && onSelect(course)}
      className={`group overflow-hidden rounded-2xl transition-all hover:shadow-xl ${isEnrolled || isFull ? "cursor-not-allowed" : "cursor-pointer"}`}
      style={{
        background: "white",
        border: "none",
        boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
      }}
    >
      {/* Hero Image */}
      <div className="relative h-56 overflow-hidden bg-slate-100">
        <img
          src={heroImage}
          alt={course.title}
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {/* Overlay gradient */}
        <div
          className="absolute inset-0"
          style={{
            background: `linear-gradient(to bottom, transparent 0%, rgba(0,0,0,0.3) 70%, rgba(0,0,0,0.5) 100%)`,
          }}
        />
        
        {/* Top badges */}
        <div className="absolute top-3 left-3 right-3 flex items-center justify-between">
          <span className="px-2.5 py-1 rounded-full font-bold text-white text-xs" style={{ background: meta.color }}>
            {course.category?.replace("_", " ") || "Course"}
          </span>
          {course.price && (
            <span className="px-2.5 py-1 rounded-full font-bold text-white text-xs" style={{ background: meta.color }}>
              ${Number(course.price)}
            </span>
          )}
        </div>

        {/* Title at bottom of image */}
        <div className="absolute bottom-0 left-0 right-0 p-4">
          <h3
            className="font-bold text-white leading-snug"
            style={{
              fontFamily: "'DM Serif Display', serif",
              fontSize: "18px",
              fontStyle: "italic",
              textShadow: "0 2px 6px rgba(0,0,0,0.3)",
            }}
          >
            {course.title}
          </h3>
          {course.instructor_name && (
            <p className="text-xs text-white/90 mt-1" style={{ textShadow: "0 1px 3px rgba(0,0,0,0.2)" }}>
              {course.instructor_name}
            </p>
          )}
        </div>
      </div>

      {/* Details Section */}
      <div className="p-4 space-y-3">
        {/* Quick Facts Row */}
        <div className="flex flex-wrap gap-2 text-xs font-semibold" style={{ color: "rgba(30,37,53,0.6)" }}>
          {course.level && (
            <span className="capitalize">{course.level}</span>
          )}
          {course.duration_hours && (
            <span className="flex items-center gap-1">
              <Clock className="w-3 h-3" /> {course.duration_hours}h
            </span>
          )}
          {nextDate && (
            <span>{new Date(nextDate).toLocaleDateString("en-US", { month: "short", day: "numeric" })}</span>
          )}
        </div>

        {/* Location */}
        {course.location && (
          <div className="flex items-center gap-2 text-xs" style={{ color: "rgba(30,37,53,0.6)" }}>
            <MapPin className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{course.location}</span>
          </div>
        )}

        {/* Certification Badge */}
        {course.certifications_awarded?.length > 0 && (
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs" style={{ background: `${meta.color}15`, color: meta.color, border: `1px solid ${meta.color}25` }}>
            <Award className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="font-semibold">{course.certifications_awarded[0].cert_name || course.certifications_awarded[0].service_type_name}</span>
          </div>
        )}

        {/* Seats Status */}
        {seatsLeft != null && (
          <p className="text-xs font-semibold text-center" style={{ color: isFull ? "#c0504d" : "rgba(30,37,53,0.5)" }}>
            {isFull ? "Class Full" : `${seatsLeft} seats left`}
          </p>
        )}

        {/* CTA Button */}
        {isEnrolled ? (
          <button className="w-full py-2.5 rounded-lg text-xs font-bold text-white" style={{ background: "#4a6b10" }}>
            ✓ Enrolled
          </button>
        ) : isFull ? (
          <button
            disabled
            className="w-full py-2.5 rounded-lg font-bold text-sm text-white opacity-70 cursor-not-allowed"
            style={{ background: "#b4534d" }}
          >
            Class Full
          </button>
        ) : (
          <button
            onClick={() => onSelect(course)}
            className="w-full py-2.5 rounded-lg font-bold text-sm text-white transition-all hover:opacity-90"
            style={{ background: meta.color }}
          >
            Enroll Now
          </button>
        )}
      </div>
    </div>
  );
}