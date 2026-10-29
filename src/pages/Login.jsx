import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { signInWithEmailAndPassword } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../firebase-config';
import 'bootstrap/dist/css/bootstrap.min.css';

import huLogo from '../assets/hu-logo.jpg'; 

const Login = () => {
  const navigate = useNavigate();
  
  const [mainCategory, setMainCategory] = useState('Student'); 
  const [selectedRole, setSelectedRole] = useState('Student'); 
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  const [formData, setFormData] = useState({ email: '', password: '', department: '' });

  useEffect(() => {
    if (mainCategory === 'Student') setSelectedRole('Student');
    if (mainCategory === 'Company') setSelectedRole('CompanyRepresentative');
    if (mainCategory === 'Staff') setSelectedRole('DepartmentStaff'); 
    
    setFormData(prev => ({ ...prev, department: '' }));
    setError('');
  }, [mainCategory]);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError('');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      // 1. Firebase Authentication
      const userCredential = await signInWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;
      
      // 2. Fetch User Profile
      const userDocRef = doc(db, "users", user.uid);
      const userDoc = await getDoc(userDocRef);

      if (userDoc.exists()) {
        const userData = userDoc.data();
        
        // 3. Status Check (Must be Active)
        if (userData.accountStatus !== 'Active') {
          setError(`Security Alert: Your account is currently ${userData.accountStatus}. Administrator approval is required.`);
          auth.signOut();
          setLoading(false);
          return;
        }

        // 4. Strict Identity Mismatch Check
        if (userData.role !== selectedRole) {
          setError('Invalid email or password');
          auth.signOut();
          setLoading(false);
          return;
        }

        // 5. Strict Department Authorization Check
        if (formData.department && userData.department && userData.department !== formData.department) {
          setError('Invalid email or password');
          auth.signOut();
          setLoading(false);
          return;
        }

        // 6. Success: Save Session and Route
        localStorage.setItem('token', user.accessToken);
        localStorage.setItem('role', userData.role);
        localStorage.setItem('userId', user.uid);
        localStorage.setItem('userName', userData.firstName || userData.name || 'User');
        
        if (userData.department) {
          localStorage.setItem('department', userData.department);
        } else {
          localStorage.removeItem('department');
        }

        if (userData.studentId) {
          localStorage.setItem('studentId', userData.studentId);
        } else {
          localStorage.removeItem('studentId');
        }

        // Precise Route Map
        const routeMap = {
          'Admin': '/admin-dashboard',
          'Student': '/student-dashboard',
          'CompanyRepresentative': '/company-dashboard',
          'DepartmentStaff': '/staff-dashboard',
          'UILOfficer': '/uil-dashboard',
          'FacultyOfficer': '/faculty-dashboard',
          'FinanceOfficer': '/finance-dashboard',
          'DeputyDirector': '/director-dashboard'
        };

        const rolePath = routeMap[userData.role] || '/';
        navigate(rolePath);

      } else {
        setError("Invalid email or password");
        auth.signOut();
        setLoading(false);
      }
    } catch (err) {
      console.error("Login Error:", err);
      
      // SECURITY OVERRIDE: Prevent Account Enumeration & Hide Specific Network Errors
      setError('Invalid email or password');
      setLoading(false);
    }
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center position-relative overflow-hidden" style={{ backgroundColor: '#EFF6FF' }}>
      
      <style>{`
        .auth-container { display: flex; width: 100%; min-height: 100vh; position: relative; z-index: 1; overflow: hidden; }
        
        .auth-banner { 
          flex: 1.2; 
          background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 40%),
                            radial-gradient(circle at 80% 70%, rgba(0, 85, 255, 0.15) 0%, transparent 40%),
                            linear-gradient(135deg, rgba(0, 26, 51, 0.98) 0%, rgba(0, 85, 255, 0.8) 100%);
          color: white; padding: 4rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; 
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        
        .auth-form-wrapper { flex: 1; padding: 3rem 4rem; display: flex; flex-direction: column; background: #ffffff; overflow-y: auto; max-height: 100vh; position: relative; }

        .auth-form-wrapper::-webkit-scrollbar { width: 6px; }
        .auth-form-wrapper::-webkit-scrollbar-thumb { background: #CBD5E1; border-radius: 10px; }

        .role-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; margin-bottom: 2rem; }
        .role-card {
          background: #ffffff; border: 1.5px solid #E2E8F0; border-radius: 16px; padding: 16px 10px; 
          text-align: center; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); color: #64748B;
          position: relative; z-index: 1; box-shadow: 0 4px 6px rgba(0,0,0,0.02);
        }
        .role-card:hover { border-color: #CBD5E1; background: #F8FAFC; transform: translateY(-2px); }
        .role-card.active { border-color: #0055FF; background: #EFF6FF; color: #001A33; box-shadow: 0 8px 20px rgba(0, 85, 255, 0.15); }
        .role-icon { font-size: 1.5rem; margin-bottom: 8px; display: block; transition: 0.3s; color: #94A3B8; }
        .role-card.active .role-icon { transform: scale(1.1); color: #0055FF; }
        .role-title { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }

        .floating-group { position: relative; margin-bottom: 1.25rem; z-index: 1; }
        .floating-input {
          width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; 
          border-radius: 12px; background: #ffffff; font-size: 0.95rem; 
          color: #1E293B; transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .floating-input:focus { border-color: #0055FF; background: #ffffff; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .floating-label { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.95rem; pointer-events: none; transition: all 0.2s ease; font-weight: 500; }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; font-size: 0.7rem; color: #0055FF; font-weight: 800; letter-spacing: 0.5px; }

        .password-toggle { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748B; cursor: pointer; padding: 0; z-index: 10; }
        .password-toggle:hover { color: #0055FF; }

        .btn-premium { background: linear-gradient(135deg, #001A33 0%, #000E1C 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 16px 24px; font-size: 1rem; letter-spacing: 0.5px; transition: 0.3s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; z-index: 1; position: relative;}
        .btn-premium:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 26, 51, 0.3); color: white; }
        .btn-premium:disabled { opacity: 0.7; cursor: not-allowed; }

        @media (max-width: 992px) {
          .auth-banner { display: none; }
          .auth-form-wrapper { padding: 3rem 2rem; }
        }

        .animate-fade-in { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="auth-container shadow-lg">
        
        {/* --- LEFT BANNER --- */}
        <div className="auth-banner d-none d-lg-flex">
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="d-flex align-items-center gap-3 mb-5">
              <div style={{ background: 'white', padding: '4px', borderRadius: '50%', display: 'inline-flex', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                <img src={huLogo} alt="Hawassa University" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '50%' }} />
              </div>
              <div>
                <h4 className="fw-bolder mb-0 text-white" style={{ letterSpacing: '1px' }}>HAWASSA UNIVERSITY</h4>
                <span className="text-white-50 fw-bold small text-uppercase" style={{ letterSpacing: '2px' }}>Faculty of Informatics</span>
              </div>
            </div>
            
            <h1 className="fw-bolder mb-3 display-5 lh-sm">Secure Portal Access.</h1>
            <p className="fs-5 text-white-50 fw-medium lh-base pe-5">
              Authenticate your identity to manage your internship lifecycle, deliverables, and clearance status.
            </p>
          </div>
          
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="d-flex align-items-center gap-3 bg-white bg-opacity-10 p-4 rounded-4 border border-white border-opacity-25" style={{ backdropFilter: 'blur(10px)' }}>
              <i className="bi bi-shield-lock-fill text-warning fs-1"></i>
              <div>
                <h6 className="fw-bolder mb-1 text-white">Institutional Security</h6>
                <p className="small mb-0 text-white-50 fw-medium">All login attempts are logged and strictly monitored. Account data is protected via industry-standard encryption.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT PANEL --- */}
        <div className="auth-form-wrapper">
          <div className="mb-4 animate-fade-in flex-shrink-0" style={{ position: 'relative', zIndex: 1 }}>
            <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Login</h2>
            <p className="text-muted fw-medium small">Select identity and enter credentials.</p>
          </div>

          {error && (
            <div className="alert alert-danger d-flex align-items-center rounded-3 shadow-sm mb-4 border-0 p-3 animate-fade-in flex-shrink-0" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', position: 'relative', zIndex: 1 }}>
              <i className="bi bi-exclamation-octagon-fill fs-5 me-3 text-danger"></i>
              <span className="fw-bold" style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="d-flex flex-column flex-grow-1" style={{ position: 'relative', zIndex: 1 }}>
            
            <div className="flex-grow-1">
              {/* VISUAL ROLE SELECTOR */}
              <div className="role-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className={`role-card ${mainCategory === 'Student' ? 'active' : ''}`} onClick={() => setMainCategory('Student')}>
                  <i className="bi bi-mortarboard-fill role-icon"></i>
                  <div className="role-title"> Student</div>
                </div>
                <div className={`role-card ${mainCategory === 'Company' ? 'active' : ''}`} onClick={() => setMainCategory('Company')}>
                  <i className="bi bi-building-fill role-icon"></i>
                  <div className="role-title">Partner</div>
                </div>
                <div className={`role-card ${mainCategory === 'Staff' ? 'active' : ''}`} onClick={() => setMainCategory('Staff')}>
                  <i className="bi bi-person-badge-fill role-icon"></i>
                  <div className="role-title">HU Staff</div>
                </div>
              </div>

              {/* DYNAMIC DROPDOWNS */}
              {mainCategory === 'Staff' && (
                <div className="floating-group animate-fade-in border-start border-4 border-success ps-2 ms-1 mb-3">
                  <select className="floating-input fw-bold text-success" style={{ appearance: 'none', cursor: 'pointer', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }} value={selectedRole} onChange={(e) => {setSelectedRole(e.target.value); setError('');}}>
                    <option value="DepartmentStaff">Department Placement Officer</option>
                    <option value="FacultyOfficer">Faculty Clearance Officer</option>
                    <option value="UILOfficer">UIL Office Administrator</option>
                    <option value="FinanceOfficer">Finance Disbursing Officer</option>
                    <option value="DeputyDirector">Deputy Director (Executive)</option>
                    <option value="Admin">System Administrator</option>
                  </select>
                  <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#065F46', fontWeight: '800' }}>Designated Authorization</label>
                  <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#10B981' }}></i>
                </div>
              )}

              {mainCategory === 'Student' && (
                <div className="floating-group animate-fade-in border-start border-4 border-primary ps-2 ms-1" style={{ animationDelay: '0.05s', marginBottom: '1.25rem' }}>
                  <select name="department" className="floating-input fw-bold bg-white" style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'pointer' }} value={formData.department} onChange={handleChange} required>
                    <option value="" disabled>Select Your Department...</option>
                    <option value="Information Systems">Information Systems</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                  <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Academic Unit</label>
                  <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                </div>
              )}

              {mainCategory === 'Staff' && selectedRole === 'DepartmentStaff' && (
                <div className="floating-group animate-fade-in border-start border-4 border-primary ps-2 ms-1" style={{ animationDelay: '0.05s', marginBottom: '1.25rem' }}>
                  <select name="department" className="floating-input fw-bold bg-white" style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'pointer' }} value={formData.department} onChange={handleChange} required>
                    <option value="" disabled>Select Department...</option>
                    <option value="Information Systems">Information Systems</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                  <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Designated Unit</label>
                  <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                </div>
              )}

              {/* EMAIL FIELD */}
              <div className="floating-group animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <input type="email" name="email" className="floating-input" placeholder=" " value={formData.email} onChange={handleChange} required />
                <label className="floating-label"> Email Address</label>
              </div>

              {/* PASSWORD FIELD */}
              <div className="floating-group animate-fade-in" style={{ animationDelay: '0.15s' }}>
                <input type={showPassword ? "text" : "password"} name="password" className="floating-input" placeholder=" " value={formData.password} onChange={handleChange} required />
                <label className="floating-label"> Password</label>
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                  <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'} fs-5`}></i>
                </button>
              </div>

              {/* FORGOT PASSWORD LINK - NOW ROUTES TO THE NEW COMPONENT */}
              <div className="d-flex justify-content-end mb-4 animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <Link to="/forgot-password" className="text-decoration-none fw-bold" style={{ fontSize: '0.85rem', color: '#0055FF' }}>
                  Forgot Password?
                </Link>
              </div>
            </div>

            <div className="mt-auto flex-shrink-0">
              <button type="submit" className="btn-premium animate-fade-in" style={{ animationDelay: '0.25s' }} disabled={loading}>
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span> AUTHENTICATING...</>
                ) : (
                  <><i className="bi bi-lock-fill me-2 fs-5"></i>  LOGIN</>
                )}
              </button>
              
              <div className="text-center mt-4 pt-4 border-top animate-fade-in" style={{ animationDelay: '0.3s' }}>
                <span className="text-muted fw-medium" style={{ fontSize: '0.95rem' }}>Don't have an account yet? </span>
                <Link to="/signup" className="text-decoration-none fw-bolder ms-1" style={{ fontSize: '0.95rem', color: '#0055FF' }}>
                    Sign Up <i className="bi bi-arrow-right-short"></i>
                </Link>
              </div>
            </div>

          </form>
        </div>

      </div>
    </div>
  );
};

export default Login;