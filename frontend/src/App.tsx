import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { LoginPage } from './pages/Login';
import { RegisterPage } from './pages/Register'; 
import { DashboardPage } from './pages/Dashboard';
import { AdminPage } from './pages/Admin';
import type { JSX } from 'react';
import { SendMessagesPage } from './pages/SendMessages';

const PrivateRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('@DynamicShots:token');
  return token ? children : <Navigate to="/login" />;
};

const AdminRoute = ({ children }: { children: JSX.Element }) => {
  const token = localStorage.getItem('@DynamicShots:token');
  const userJson = localStorage.getItem('@DynamicShots:user');
  const user = userJson ? JSON.parse(userJson) : null;

  if (!token || user?.role !== 'ADMIN') {
    return <Navigate to="/dashboard" />;
  }
  return children;
};

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />

        <Route 
          path="/dashboard" 
          element={
            <PrivateRoute>
              <DashboardPage />
            </PrivateRoute>
          } 
        />

        <Route 
          path="/z-admin" 
          element={
            <AdminRoute>
              <AdminPage />
            </AdminRoute>
          } 
        />

        <Route 
          path="*" 
          element={
          <Navigate to="/login" />
          } 
        />

          <Route 
            path="/disparos" 
            element={
            <PrivateRoute>
            <SendMessagesPage />
            </PrivateRoute>
          } 
        />
      </Routes>
    </BrowserRouter>
  );
}

export default App;