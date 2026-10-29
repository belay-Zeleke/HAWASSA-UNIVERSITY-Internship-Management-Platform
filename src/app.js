import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'bootstrap-icons/font/bootstrap-icons.css';

// --- Authentication ---
import Login from './pages/Login';
import Signup from './pages/Signup';
import ForgotPassword from './pages/ForgotPassword'; 
import ProtectedRoute from './components/ProtectedRoute';

// --- Student Pages ---
import StudentDashboard from './pages/StudentDashboard';
import InternshipApplication from './pages/InternshipApplication';
import StudentLogbook from './pages/StudentLogbook';

// --- Company Pages ---
import CompanyDashboard from './pages/CompanyDashboard';
import CompanyEvaluations from './pages/CompanyEvaluations'; 

// --- Staff & Operations ---
import DepartmentDashboard from './pages/StaffDashboard'; 
import StudentRoster from './pages/StudentRoster'; // <-- ADDED STUDENT ROSTER IMPORT
import UILDashboard from './pages/UILDashboard';

// --- Management & Approval Chain ---
import FacultyDashboard from './pages/FacultyDashboard';
import FinanceDashboard from './pages/FinanceDashboard';
import DirectorDashboard from './pages/DirectorDashboard';

// --- System Administrator ---
import AdminDashboard from './pages/AdminDashboard'; 

function App() {
  return (
    <Router>
      <Routes>
        
        {/* --- Public Routes --- */}
        <Route path="/" element={<Navigate to="/login" />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route path="/forgot-password" element={<ForgotPassword />} /> 

        {/* --- STUDENT ROUTES --- */}
        <Route 
          path="/student-dashboard" 
          element={<ProtectedRoute role="Student"><StudentDashboard /></ProtectedRoute>} 
        />
        <Route 
          path="/application" 
          element={<ProtectedRoute role="Student"><InternshipApplication /></ProtectedRoute>} 
        />
        <Route 
          path="/student-logbook" 
          element={<ProtectedRoute role="Student"><StudentLogbook /></ProtectedRoute>} 
        />
        
        {/* If login sends user to /logbook, automatically redirect to /student-logbook */}
        <Route path="/logbook" element={<Navigate to="/student-logbook" replace />} />

        {/* --- COMPANY ROUTES --- */}
        <Route 
          path="/company-dashboard" 
          element={<ProtectedRoute role="CompanyRepresentative"><CompanyDashboard /></ProtectedRoute>} 
        />
        <Route 
          path="/evaluations" 
          element={<ProtectedRoute role="CompanyRepresentative"><CompanyEvaluations /></ProtectedRoute>} 
        />

        {/* --- DEPARTMENT STAFF / UIL ROUTES --- */}
        <Route 
          path="/staff-dashboard" 
          element={<ProtectedRoute role="DepartmentStaff"><DepartmentDashboard /></ProtectedRoute>} 
        />
        
        {/* NEW: Student Roster Route */}
        <Route 
          path="/student-roster" 
          element={<ProtectedRoute role="DepartmentStaff"><StudentRoster /></ProtectedRoute>} 
        />
        
        {/* If login sends user to /department-dashboard, automatically redirect to /staff-dashboard */}
        <Route path="/department-dashboard" element={<Navigate to="/staff-dashboard" replace />} />
        <Route path="/department" element={<Navigate to="/staff-dashboard" replace />} />
        
        <Route 
          path="/uil-dashboard" 
          element={<ProtectedRoute role="UILOfficer"><UILDashboard /></ProtectedRoute>} 
        />

        {/* --- FACULTY OFFICER ROUTES --- */}
        <Route 
          path="/faculty-dashboard" 
          element={<ProtectedRoute role="FacultyOfficer"><FacultyDashboard /></ProtectedRoute>} 
        />

        {/* --- FINANCE OFFICER ROUTES --- */}
        <Route 
          path="/finance-dashboard" 
          element={<ProtectedRoute role="FinanceOfficer"><FinanceDashboard /></ProtectedRoute>} 
        />

        {/* --- DEPUTY DIRECTOR ROUTES --- */}
        <Route 
          path="/director-dashboard" 
          element={<ProtectedRoute role="DeputyDirector"><DirectorDashboard /></ProtectedRoute>} 
        />

        {/* --- SYSTEM ADMIN ROUTE --- */}
        <Route 
          path="/admin-dashboard" 
          element={<ProtectedRoute role="Admin"><AdminDashboard /></ProtectedRoute>} 
        />

        {/* --- 404 Page (Fallback - Must be at the very bottom) --- */}
        <Route path="*" element={
          <div className="d-flex flex-column justify-content-center align-items-center vh-100 bg-light">
            <h1 className="display-1 text-danger fw-bold">404</h1>
            <h3 className="mb-4">Page Not Found</h3>
            <p className="text-muted mb-4">The page you are looking for does not exist or you do not have access.</p>
            <a href="/login" className="btn btn-primary px-4 py-2">Go Back Home</a>
          </div>
        } />

      </Routes>
    </Router>
  );
}

export default App;