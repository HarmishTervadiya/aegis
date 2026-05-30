import axios from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

// Cookies are sent automatically via withCredentials — no manual token handling needed
const api = axios.create({ baseURL: BASE_URL, withCredentials: true });

// Unwrap the { success, data, errors } envelope
api.interceptors.response.use(
  (res) => {
    if (res.data && typeof res.data.success === "boolean") {
      if (res.data.success) {
        return { ...res, data: res.data.data };
      } else {
        return Promise.reject(new Error(res.data.errors || "API Error"));
      }
    }
    return res;
  },
  (err) => {
    const msg = err.response?.data?.errors || err.message;
    return Promise.reject(new Error(msg));
  },
);

export default api;
