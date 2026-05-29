import axios from "axios";

const BASE_URL = import.meta.env.VITE_BACKEND_URL || "http://localhost:3001";

const api = axios.create({ baseURL: BASE_URL });

// Attach JWT to every request if present
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("aegis_token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// On 401, clear the token and let the user re-authenticate
api.interceptors.response.use(
  (res) => {
    // Unwrap the { success, data, errors } format
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
    if (err.response?.status === 401) {
      localStorage.removeItem("aegis_token");
    }
    const msg = err.response?.data?.errors || err.message;
    return Promise.reject(new Error(msg));
  },
);

export default api;
