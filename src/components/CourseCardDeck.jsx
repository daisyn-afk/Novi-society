import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, BookOpen, Clock, MapPin, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const levelColor = { beginner: "bg-green-100 text-green-700", intermediate: "bg-blue-100 text-blue-700", advanced: "bg-purple-100 text-purple-700" };

export default function CourseCardDeck({ courses, onSelectCourse, enrolledIds }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState(0);
  const containerRef = useRef(null);

  const handlePrev = () => {
    setCurrentIndex(prev => (prev === 0 ? courses.length - 1 : prev - 1));
  };

  const handleNext = () => {
    setCurrentIndex(prev => (prev === courses.length - 1 ? 0 : prev + 1));
  };

  const handleMouseDown = (e) => {
    setIsDragging(true);
    setDragStart(e.clientX);
  };

  const handleMouseUp = (e) => {
    if (!isDragging) return;
    const diff = e.clientX - dragStart;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handlePrev();
      else handleNext();
    }
    setIsDragging(false);
  };

  const handleMouseMove = (e) => {
    if (!isDragging) return;
  };

  const handleTouchStart = (e) => {
    setDragStart(e.touches[0].clientX);
  };

  const handleTouchEnd = (e) => {
    const diff = e.changedTouches[0].clientX - dragStart;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handlePrev();
      else handleNext();
    }
  };

  if (!courses || courses.length === 0) return null;

  const current = courses[currentIndex];
  if (!current) return null;

  const enrolled = enrolledIds?.has(current.id);

  return (
    <div className="w-full max-w-5xl mx-auto">
      {/* Card Container */}
      <div
        ref={containerRef}
        className="relative h-80 perspective cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseUp={handleMouseUp}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Card */}
        <div
          className="w-full h-full rounded-2xl transition-all duration-300 flex overflow-hidden"
          style={{
            background: "#f5f3ef",
            border: "1px solid rgba(123,142,200,0.12)",
            boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
            cursor: isDragging ? "grabbing" : "grab",
            transform: `scale(${isDragging ? 0.98 : 1})`,
            opacity: isDragging ? 0.9 : 1,
          }}
        >
          {/* Image Section - Left */}
          <div className="w-2/5 flex-shrink-0 overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(123,142,200,0.08) 0%, rgba(200,230,60,0.06) 100%)" }}>
            {current.cover_image_url ? (
              <img src={current.cover_image_url} alt={current.title} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <BookOpen className="w-16 h-16" style={{ color: "rgba(123,142,200,0.15)" }} />
              </div>
            )}
          </div>

          {/* Content Section - Right */}
          <div className="flex-1 p-8 flex flex-col justify-between">
            <div className="space-y-2">
              <h3 className="text-2xl font-semibold leading-snug" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif", fontStyle: "italic" }}>
                {current.title}
              </h3>
              <p className="text-xs leading-relaxed" style={{ color: "#8891a8" }}>
                {current.description}
              </p>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 gap-4 py-4">
              {current.duration_hours && (
                <div className="flex items-center gap-2">
                  <Clock className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                  <span className="text-xs" style={{ color: "#5a6480" }}>{current.duration_hours}h</span>
                </div>
              )}
              {current.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                  <span className="text-xs" style={{ color: "#5a6480" }}>{current.location}</span>
                </div>
              )}
              {current.available_seats !== undefined && (
                <div className="flex items-center gap-2">
                  <Users className="w-4 h-4" style={{ color: "#7B8EC8" }} />
                  <span className="text-xs" style={{ color: "#5a6480" }}>{current.available_seats} left</span>
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <span className="text-xs" style={{ color: "#8891a8" }}>From</span>
                <p className="text-2xl font-bold" style={{ color: "#1e2535" }}>
                  ${Number(current.price || 0).toLocaleString()}
                </p>
              </div>
              <Button
                onClick={() => onSelectCourse(current)}
                className="flex-shrink-0"
                style={{ background: "linear-gradient(135deg, #DA6A63 0%, #FA6F30 100%)", color: "#fff", borderRadius: "10px", fontSize: "13px", fontWeight: 600, padding: "10px 20px" }}
              >
                View Details
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Controls */}
      <div className="flex items-center justify-between mt-8">
        <button
          onClick={handlePrev}
          className="p-2 rounded-full transition-all hover:opacity-70"
          style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}
        >
          <ChevronLeft className="w-6 h-6" />
        </button>

        {/* Indicator Dots */}
        <div className="flex gap-2">
          {courses.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className="transition-all rounded-full"
              style={{
                width: i === currentIndex ? 32 : 8,
                height: 8,
                background: i === currentIndex ? "#FA6F30" : "rgba(123,142,200,0.2)",
              }}
            />
          ))}
        </div>

        <button
          onClick={handleNext}
          className="p-2 rounded-full transition-all hover:opacity-70"
          style={{ background: "rgba(123,142,200,0.1)", color: "#7B8EC8" }}
        >
          <ChevronRight className="w-6 h-6" />
        </button>
      </div>

      {/* Progress Text */}
      <div className="text-center mt-4" style={{ color: "#8891a8", fontSize: 12 }}>
        {currentIndex + 1} / {courses.length}
      </div>
    </div>
  );
}