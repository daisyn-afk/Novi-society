/** Shared initial form state for scheduled-course dialogs (kept out of ScheduleCourseForm for Fast Refresh). */
export const EMPTY_SCHEDULED = {
  type: "scheduled",
  template_id: "",
  title: "",
  price: "",
  location: "",
  instructor_name: "",
  session_dates: [],
  is_active: true,
  is_featured: false,
};
