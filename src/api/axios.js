import axios from 'axios';

// 1. Create the Axios instance
const api = axios.create({
  baseURL: 'http://localhost:5000/api', // Ensure this matches your Node.js backend port
  headers: {
    'Content-Type': 'application/json',
  },
});

// 2. Request Interceptor
// This automatically adds the 'Authorization' header with your token
// to every request if the user is logged in.
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token'); // Retrieve token from local storage
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// 3. Response Interceptor (Optional but Recommended)
// This handles global errors, like if a token expires (401 Unauthorized),
// it can automatically redirect the user to login.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      // Token expired or invalid
      localStorage.clear();
      window.location.href = '/login'; // Force redirect to login
    }
    return Promise.reject(error);
  }
);

export default api;