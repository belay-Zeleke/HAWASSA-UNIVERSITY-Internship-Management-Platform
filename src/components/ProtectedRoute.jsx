import React from 'react';
import { Navigate } from 'react-router-dom';

const ProtectedRoute = ({ children, role }) => {
  const token = localStorage.getItem('token');
  const userRole = localStorage.getItem('role');

  // 1. If not logged in, force them to Login page
  if (!token) {
    return <Navigate to="/login" replace />;
  }

  // 2. Authorization Check:
  // If the route has a specific role requirement (e.g., role="Student")
  // and the logged-in user DOES NOT match that role...
  if (role && userRole !== role) {
    
    // 3. Smart Redirect: Send them to their CORRECT dashboard
    switch(userRole) {
      case 'Student': 
        return <Navigate to="/student-dashboard" replace />;
      
      case 'DepartmentStaff': 
        return <Navigate to="/staff-dashboard" replace />;
      
      case 'CompanyRepresentative': 
        return <Navigate to="/company-dashboard" replace />;
      
      case 'FacultyOfficer': 
        return <Navigate to="/faculty-dashboard" replace />;
      
      case 'FinanceOfficer': 
        return <Navigate to="/finance-dashboard" replace />;
      
      case 'DeputyDirector': 
        return <Navigate to="/director-dashboard" replace />;
      
      case 'UILOfficer': 
        return <Navigate to="/uil-dashboard" replace />;
        
      // If role is unrecognized, send back to login
      default: 
        return <Navigate to="/login" replace />;
    }
  }

  // 4. If authorized, show the page
  return children;
};

export default ProtectedRoute;