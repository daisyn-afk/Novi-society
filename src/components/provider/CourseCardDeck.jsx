import { useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import CourseBrowseCard from "./CourseBrowseCard";

export default function CourseCardDeck({ courses, isEnrolled, onSelect, title, showControls = true }) {
  const scrollContainerRef = useRef(null);
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  const checkScroll = () => {
    if (scrollContainerRef.current) {
      const { scrollLeft, scrollWidth, clientWidth } = scrollContainerRef.current;
      setCanScrollLeft(scrollLeft > 0);
      setCanScrollRight(scrollLeft < scrollWidth - clientWidth - 10);
    }
  };

  const scroll = (direction) => {
    if (scrollContainerRef.current) {
      const scrollAmount = 400;
      scrollContainerRef.current.scrollBy({
        left: direction === "left" ? -scrollAmount : scrollAmount,
        behavior: "smooth",
      });
      setTimeout(checkScroll, 100);
    }
  };

  return (
    <div className="space-y-4">
      {title && (
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-bold" style={{ color: "#1e2535", fontFamily: "'DM Serif Display', serif" }}>
              {title}
            </h3>
            <p className="text-xs mt-0.5" style={{ color: "rgba(30,37,53,0.5)" }}>
              {courses.length} course{courses.length !== 1 ? "s" : ""}
            </p>
          </div>
          {showControls && (canScrollLeft || canScrollRight) && (
            <div className="flex gap-1.5">
              <button
                onClick={() => scroll("left")}
                disabled={!canScrollLeft}
                className="p-2 rounded-lg transition-all disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)" }}
              >
                <ChevronLeft className="w-4 h-4" style={{ color: "#1e2535" }} />
              </button>
              <button
                onClick={() => scroll("right")}
                disabled={!canScrollRight}
                className="p-2 rounded-lg transition-all disabled:opacity-30"
                style={{ background: "rgba(255,255,255,0.6)", border: "1px solid rgba(255,255,255,0.8)" }}
              >
                <ChevronRight className="w-4 h-4" style={{ color: "#1e2535" }} />
              </button>
            </div>
          )}
        </div>
      )}

      {/* Scrollable Container */}
      <div
        ref={scrollContainerRef}
        onScroll={checkScroll}
        className="flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory scroll-smooth"
        style={{ scrollbarWidth: "none", msOverflowStyle: "none" }}
      >
        {courses.map(course => (
          <div
            key={course.id}
            className="flex-shrink-0 snap-start w-80 sm:w-96"
          >
            <CourseBrowseCard
              course={course}
              isEnrolled={isEnrolled(course.id)}
              onSelect={onSelect}
            />
          </div>
        ))}
      </div>
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}