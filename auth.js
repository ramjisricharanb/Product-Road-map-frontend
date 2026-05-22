// auth.js - Handles authentication state and tokens (Bypassed per user request)

const TOKEN_KEY = "nconnect_auth_token";
const USER_KEY = "nconnect_user";

function saveAuthData(token, user) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

function clearAuthData() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
}

function getToken() {
  // Always return a dummy token to bypass auth checks
  return localStorage.getItem(TOKEN_KEY) || "dummy_token";
}

function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) {
    // Return default admin profile to keep the dashboard profile and admin panel functional
    return { email: "ramji.sricharan@narayanagroup.com", role: "ADMIN" };
  }
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return { email: "ramji.sricharan@narayanagroup.com", role: "ADMIN" };
  }
}

function isAuthenticated() {
  return !!getToken();
}

function getAuthHeaders() {
  const token = getToken();
  return {
    "Content-Type": "application/json",
    ...(token ? { "Authorization": `Bearer ${token}` } : {})
  };
}

function logout() {
  clearAuthData();
  // Redirect to dashboard index instead of login page
  window.location.href = "./index.html";
}

function checkAuthProtection() {
  const isAuthPage = window.location.pathname.includes("login.html") || 
                     window.location.pathname.includes("signup.html") ||
                     window.location.pathname.includes("forgot-password.html") ||
                     window.location.pathname.includes("reset-password.html");
                     
  if (isAuthPage) {
    // Automatically redirect all login/signup screens straight to the dashboard
    window.location.href = "./index.html";
  }
}

// Check protection immediately when script loads
checkAuthProtection();

