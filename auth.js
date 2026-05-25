// auth.js - Handles authentication state and tokens

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
  return localStorage.getItem(TOKEN_KEY);
}

function getUser() {
  const userStr = localStorage.getItem(USER_KEY);
  if (!userStr) return null;
  try {
    return JSON.parse(userStr);
  } catch (e) {
    return null;
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
  window.location.href = "./login.html";
}

function checkAuthProtection() {
  // If we are on a protected page (like index.html) and not authenticated, redirect to login
  const isAuthPage = window.location.pathname.includes("login.html") || 
                     window.location.pathname.includes("signup.html") ||
                     window.location.pathname.includes("forgot-password.html") ||
                     window.location.pathname.includes("reset-password.html");
                     
  if (!isAuthenticated() && !isAuthPage) {
    window.location.href = "./login.html";
  } else if (isAuthenticated() && isAuthPage) {
    // If we are authenticated but on an auth page, redirect to dashboard
    window.location.href = "./index.html";
  }
}

// Check protection immediately when script loads
checkAuthProtection();

