export const setToken = (token) => {
  localStorage.setItem('ayumitra-token', token);
};

export const getToken = () => {
  return localStorage.getItem('ayumitra-token');
};

export const setUser = (user) => {
  localStorage.setItem('ayumitra-user', JSON.stringify(user));
};

export const getUser = () => {
  const user = localStorage.getItem('ayumitra-user');
  return user ? JSON.parse(user) : null;
};

export const clearAuth = () => {
  localStorage.removeItem('ayumitra-token');
  localStorage.removeItem('ayumitra-user');
};

export const isAuthenticated = () => {
  return !!getToken();
};