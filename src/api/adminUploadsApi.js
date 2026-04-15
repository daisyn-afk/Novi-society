import { adminApiRequest } from "./adminApiRequest.js";

export const adminUploadsApi = {
  uploadCourseCoverImage: (file) => {
    const formData = new FormData();
    formData.append("file", file);
    return adminApiRequest("/admin/uploads/course-cover", {
      method: "POST",
      body: formData
    });
  }
};
