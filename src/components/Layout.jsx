import React, { useState, useEffect } from 'react';
import { useNavigate, Link, useLocation } from 'react-router-dom';
import { auth } from '../firebase-config';
import 'bootstrap/dist/css/bootstrap.min.css';

// Official HU Logo
import huLogo from '../assets/hu-logo.jpg';

const Layout = ({ children, role, userName }) => {
  const navigate = useNavigate();
  const location = useLocation();
  
  // Advanced State Management for Layout UI
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [isMobileOpen, setIsMobileOpen] = useState(false);

  const handleLogout = () => {
    auth.signOut();
    localStorage.clear();
    navigate('/');
  };

  const isActive = (path) => location.pathname === path;
  
  // Uses Hailemichael as the sleek default if local storage hasn't caught up
  const displayName = userName || 'Hailemichael'; 

  // Close mobile sidebar when route changes
  useEffect(() => {
    setIsMobileOpen(false);
  }, [location.pathname]);

  const getLinks = () => {
    const linkStyle = (path) => `
      sidebar-link d-flex align-items-center mb-2 text-decoration-none
      ${isActive(path) ? 'active-link' : 'inactive-link'}
      ${isCollapsed ? 'justify-content-center collapsed-link' : 'px-4 py-3'}
    `;

    const iconStyle = `fs-5 ${isCollapsed ? '' : 'me-3'}`;
    const textStyle = `fw-semibold tracking-wide nav-text ${isCollapsed ? 'd-none' : 'd-block'}`;

    switch(role) {
      case 'Student':
        return (
          <>
            <Link to="/student-dashboard" className={linkStyle('/student-dashboard')} title="Dashboard">
              <i className={`bi bi-grid-1x2-fill ${iconStyle}`}></i> <span className={textStyle}>Dashboard</span>
            </Link>
            {/* Internship Form removed, now handled dynamically inside the dashboard */}
            <Link to="/logbook" className={linkStyle('/logbook')} title="My Logbook">
              <i className={`bi bi-journal-check ${iconStyle}`}></i> <span className={textStyle}>My Logbook</span>
            </Link>
          </>
        );
      case 'DepartmentStaff':
        return (
          <>
            <Link to="/staff-dashboard" className={linkStyle('/staff-dashboard')} title="Applications">
              <i className={`bi bi-inbox-fill ${iconStyle}`}></i> <span className={textStyle}>Applications</span>
            </Link>
            {/* FIXED: Pointing to /student-roster instead of # */}
            <Link to="/student-roster" className={linkStyle('/student-roster')} title="Student Monitor">
              <i className={`bi bi-people-fill ${iconStyle}`}></i> <span className={textStyle}>Student Roster</span>
            </Link>
          </>
        );
      case 'CompanyRepresentative':
        return (
          <>
            <Link to="/company-dashboard" className={linkStyle('/company-dashboard')} title="Company Portal">
              <i className={`bi bi-building-fill ${iconStyle}`}></i> <span className={textStyle}>Company Portal</span>
            </Link>
            <Link to="/evaluations" className={linkStyle('/evaluations')} title="Evaluations">
              <i className={`bi bi-star-fill ${iconStyle}`}></i> <span className={textStyle}>Evaluations</span>
            </Link>
          </>
        );
      default:
        return (
          <Link to="#" className={linkStyle('#')} title="Home">
            <i className={`bi bi-house-fill ${iconStyle}`}></i><span className={textStyle}>Home</span>
          </Link>
        );
    }
  };

  return (
    <>
      <style>{`
        :root {
          --hu-navy: #001A33;
          --hu-navy-dark: #000E1C;
          --hu-gold: #FFC107;
          --bg-canvas: #F8FAFC;
          --sidebar-width: 280px;
          --sidebar-collapsed-width: 88px;
          --transition-smooth: all 0.4s cubic-bezier(0.4, 0, 0.2, 1);
        }

        .layout-wrapper {
          background-color: var(--bg-canvas); 
          font-family: 'Inter', system-ui, -apple-system, sans-serif;
          /* Subtle Mesh Gradient Background */
          background-image: 
            radial-gradient(at 0% 0%, rgba(0, 51, 102, 0.03) 0px, transparent 50%),
            radial-gradient(at 100% 100%, rgba(255, 193, 7, 0.04) 0px, transparent 50%);
        }
        
        /* --- ADVANCED SIDEBAR --- */
        .sidebar-container {
          width: var(--sidebar-width);
          background: linear-gradient(180deg, var(--hu-navy) 0%, var(--hu-navy-dark) 100%);
          box-shadow: 4px 0 24px rgba(0,0,0,0.06);
          z-index: 1040;
          transition: var(--transition-smooth);
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        
        .sidebar-container.collapsed {
          width: var(--sidebar-collapsed-width);
        }

        .sidebar-link {
          color: rgba(255, 255, 255, 0.65);
          border-radius: 12px;
          margin: 0 16px; 
          transition: var(--transition-smooth);
          white-space: nowrap;
          height: 52px;
        }
        
        .sidebar-link.collapsed-link {
          margin: 0 16px 8px 16px;
          border-radius: 16px;
        }

        .sidebar-link:hover {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.08);
          transform: translateX(4px);
        }
        
        .sidebar-container.collapsed .sidebar-link:hover {
          transform: translateY(-2px); /* Lifts up instead of right when collapsed */
        }

        .active-link {
          color: #ffffff;
          background-color: rgba(255, 255, 255, 0.12);
          box-shadow: inset 4px 0 0 var(--hu-gold); 
        }

        .sidebar-container.collapsed .active-link {
          box-shadow: inset 0 -4px 0 var(--hu-gold); /* Gold bar moves to bottom in mini mode */
        }

        .nav-text {
          opacity: 1;
          transition: opacity 0.3s ease;
        }

        /* --- ADVANCED HEADER --- */
        .perfect-header {
          background: rgba(255, 255, 255, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(0,0,0,0.05);
          z-index: 1030;
          height: 76px;
        }

        .toggle-btn {
          width: 40px; height: 40px;
          border-radius: 10px;
          background: transparent;
          color: #64748B;
          border: 1px solid transparent;
          display: flex; align-items: center; justify-content: center;
          transition: var(--transition-smooth);
          cursor: pointer;
        }
        
        .toggle-btn:hover {
          background: #F1F5F9;
          color: var(--hu-navy);
          border-color: #E2E8F0;
        }

        .user-pill {
          background: #ffffff; border: 1px solid transparent;
          padding: 4px 12px 4px 4px; border-radius: 50px;
          transition: all 0.2s ease; cursor: pointer;
        }
        .user-pill:hover {
          background: #F8FAFC; border-color: #E2E8F0;
          box-shadow: 0 4px 12px rgba(0, 0, 0, 0.03);
          transform: translateY(-1px);
        }
        
        .avatar-circle {
          background: var(--hu-navy); color: #ffffff;
          box-shadow: 0 2px 6px rgba(0, 26, 51, 0.2);
        }

        /* --- MOBILE DRAWER OVERLAY --- */
        .mobile-overlay {
          position: fixed; top: 0; left: 0; width: 100vw; height: 100vh;
          background: rgba(0, 14, 28, 0.4); backdrop-filter: blur(4px);
          z-index: 1035; opacity: 0; visibility: hidden;
          transition: var(--transition-smooth);
        }
        .mobile-overlay.show {
          opacity: 1; visibility: visible;
        }

        /* Responsive Logic */
        @media (max-width: 991.98px) {
          .sidebar-container {
            position: fixed; top: 0; left: 0; height: 100vh;
            transform: translateX(-100%);
          }
          .sidebar-container.mobile-open {
            transform: translateX(0);
          }
        }

        /* Main Content Entry Animation */
        .page-transition {
          animation: fadeSlideUp 0.5s cubic-bezier(0.4, 0, 0.2, 1) forwards;
        }
        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(15px); }
          to { opacity: 1; transform: translateY(0); }
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }
        ::-webkit-scrollbar-thumb:hover { background: #94A3B8; }
      `}</style>

      <div className="layout-wrapper d-flex vh-100 overflow-hidden">
        
        {/* --- MOBILE OVERLAY --- */}
        <div 
          className={`mobile-overlay d-lg-none ${isMobileOpen ? 'show' : ''}`} 
          onClick={() => setIsMobileOpen(false)}
        ></div>

        {/* --- ADVANCED COLLAPSIBLE SIDEBAR --- */}
        <aside className={`sidebar-container ${isCollapsed ? 'collapsed' : ''} ${isMobileOpen ? 'mobile-open' : ''}`}>
          
          {/* Sidebar Header (Logo) */}
          <div className="d-flex align-items-center justify-content-center" style={{ height: '76px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
             <img 
               src={huLogo} 
               alt="HU Logo" 
               style={{ 
                 height: isCollapsed ? '42px' : '46px', width: isCollapsed ? '42px' : '46px',
                 objectFit: 'contain', borderRadius: '50%', backgroundColor: '#ffffff', 
                 border: '2px solid rgba(255,255,255,0.1)', padding: '2px',
                 transition: 'all 0.3s ease'
               }} 
             />
             {!isCollapsed && (
               <div className="ms-3 d-flex flex-column nav-text">
                 <span className="fw-bolder text-white lh-1" style={{ fontSize: '1.1rem', letterSpacing: '0.5px' }}>HU Portal</span>
                 <span style={{ fontSize: '0.65rem', color: '#FFCC00', fontWeight: '700', letterSpacing: '1.5px', textTransform: 'uppercase', marginTop: '4px' }}>Informatics</span>
               </div>
             )}
          </div>

          {/* Navigation Links */}
          <div className="flex-grow-1 d-flex flex-column mt-4 pt-2" style={{ overflowY: 'auto', overflowX: 'hidden' }}>
             {!isCollapsed && (
               <span className="px-4 mb-3 nav-text" style={{ fontSize: '0.65rem', fontWeight: '800', color: 'rgba(255,255,255,0.3)', letterSpacing: '2px', textTransform: 'uppercase' }}>
                 Main Menu
               </span>
             )}
             {getLinks()}
          </div>
          
          {/* Logout Button */}
          <div className="p-3 mt-auto border-top" style={{ borderColor: 'rgba(255,255,255,0.05) !important' }}>
            <button 
              onClick={handleLogout} 
              className={`btn w-100 d-flex align-items-center border-0 ${isCollapsed ? 'justify-content-center px-0 py-3' : 'px-3 py-2 gap-2'}`}
              style={{ 
                background: 'rgba(239, 68, 68, 0.1)', color: '#EF4444',
                borderRadius: '12px', fontWeight: '700', transition: 'all 0.2s ease'
              }}
              onMouseOver={(e) => { e.currentTarget.style.background = '#EF4444'; e.currentTarget.style.color = '#ffffff'; }}
              onMouseOut={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)'; e.currentTarget.style.color = '#EF4444'; }}
              title="Secure Logout"
            >
              <i className="bi bi-box-arrow-left fs-5"></i> 
              {!isCollapsed && <span className="nav-text">Logout</span>}
            </button>
          </div>
        </aside>

        {/* --- MAIN CONTENT CANVAS --- */}
        <div className="flex-grow-1 d-flex flex-column position-relative overflow-hidden">
          
          {/* ADVANCED HEADER */}
          <header className="perfect-header px-3 px-md-4 d-flex justify-content-between align-items-center">
            
            <div className="d-flex align-items-center gap-3">
              {/* Desktop Collapse Toggle */}
              <button 
                className="toggle-btn d-none d-lg-flex" 
                onClick={() => setIsCollapsed(!isCollapsed)}
                title="Toggle Sidebar"
              >
                <i className={`fs-5 bi ${isCollapsed ? 'bi-layout-sidebar-inset' : 'bi-layout-sidebar'}`}></i>
              </button>
              
              {/* Mobile Drawer Toggle */}
              <button 
                className="toggle-btn d-lg-none" 
                onClick={() => setIsMobileOpen(true)}
              >
                <i className="bi bi-list fs-4"></i>
              </button>

              <div className="d-none d-sm-flex align-items-center text-muted" style={{ fontSize: '0.85rem', fontWeight: '600' }}>
                <i className="bi bi-house-door me-2"></i> / <span className="text-dark mx-2 text-capitalize">{location.pathname.replace('/', '').replace('-', ' ') || 'Home'}</span>
              </div>
            </div>

            <div className="d-flex align-items-center gap-3">
              {/* Notification Bell */}
              <div className="toggle-btn position-relative d-none d-sm-flex">
                <i className="bi bi-bell fs-5"></i>
                <span className="position-absolute p-1 bg-danger border border-2 border-white rounded-circle" style={{ top: '8px', right: '8px' }}></span>
              </div>

              {/* User Profile Pill */}
              <div className="user-pill d-flex align-items-center gap-2">
                <div className="text-end d-none d-md-block ps-2 pe-1">
                  <div style={{ fontSize: '0.85rem', fontWeight: '700', color: '#1E293B', lineHeight: '1.2' }}>
                    {displayName}
                  </div>
                  <div style={{ fontSize: '0.65rem', fontWeight: '800', color: '#003366', letterSpacing: '0.5px' }}>
                    {role ? role.toUpperCase() : 'USER'}
                  </div>
                </div>
                
                <div 
                  className="avatar-circle d-flex align-items-center justify-content-center rounded-circle border border-2 border-white" 
                  style={{ width: '36px', height: '36px', fontSize: '1rem', fontWeight: '800' }}
                >
                  {displayName.charAt(0).toUpperCase()}
                </div>
                <i className="bi bi-chevron-down text-muted small pe-1 d-none d-md-block"></i>
              </div>
            </div>
          </header>

          {/* SCROLLABLE PAGE CONTENT */}
          <main className="flex-grow-1 position-relative p-4 p-md-5 overflow-auto page-transition">
            <div className="mx-auto" style={{ maxWidth: '1400px' }}>
              {children}
            </div>
          </main>

        </div>
      </div>
    </>
  );
};

export default Layout;