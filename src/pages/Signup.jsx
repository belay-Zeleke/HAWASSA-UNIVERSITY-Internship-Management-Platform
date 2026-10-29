import React, { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { createUserWithEmailAndPassword } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs } from 'firebase/firestore'; 
import { auth, db } from '../firebase-config';
import emailjs from '@emailjs/browser';
import 'bootstrap/dist/css/bootstrap.min.css';

import huLogo from '../assets/hu-logo.jpg'; 

const Signup = () => {
  const navigate = useNavigate();
  
  const [mainCategory, setMainCategory] = useState('Student'); 
  const [selectedRole, setSelectedRole] = useState('Student'); 
  
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  
  // --- OTP Verification States ---
  const [showOtpScreen, setShowOtpScreen] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
  const [userOtpInput, setUserOtpInput] = useState('');

  const [formData, setFormData] = useState({
    email: '', password: '', firstName: '', lastName: '',
    studentId: '', department: '', companyName: '', location: '', staffId: ''
  });

  useEffect(() => {
    if (mainCategory === 'Student') setSelectedRole('Student');
    if (mainCategory === 'Company') setSelectedRole('CompanyRepresentative');
    if (mainCategory === 'Staff') setSelectedRole('DepartmentStaff'); 
    
    // Clear department if switching categories to prevent invalid data
    setFormData(prev => ({ ...prev, department: '' }));
    setError('');
  }, [mainCategory]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === 'studentId') {
      let cleanValue = value.replace(/[^0-9]/g, ''); 
      if (cleanValue.length > 4) {
        cleanValue = cleanValue.substring(0, 4) + '/' + cleanValue.substring(4, 6);
      }
      setFormData({ ...formData, studentId: cleanValue });
    } else {
      setFormData({ ...formData, [name]: value });
    }
    setError('');
  };

  const getFriendlyErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/email-already-in-use': return 'This email is already registered. Please log in instead.';
      case 'auth/weak-password': return 'Password is too weak. It must be at least 6 characters.';
      case 'auth/invalid-email': return 'Please enter a valid email address.';
      default: return 'Registration failed. Please check your connection and try again.';
    }
  };

  // ==========================================
  // STEP 1: VALIDATE FORM & SEND EMAIL OTP
  // ==========================================
  const handleInitiateSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccessMsg('');

    try {
      if (mainCategory === 'Student') {
        const idRegex = /^\d{4}\/\d{2}$/;
        if (!idRegex.test(formData.studentId)) {
          setError('Invalid Format. Student ID must be exactly 0000/YY (e.g., 0665/15).');
          setLoading(false);
          return;
        }

        const admissionYear = parseInt(formData.studentId.split('/')[1]);
        if (admissionYear < 10 || admissionYear > 30) {
          setError(`Validation Error: '${admissionYear}' is not a recognized admission year. Please use your correct 2-digit batch year.`);
          setLoading(false);
          return;
        }

        const idQuery = query(collection(db, "users"), where("studentId", "==", formData.studentId));
        const idSnapshot = await getDocs(idQuery);
        if (!idSnapshot.empty) {
          setError(`The ID ${formData.studentId} is already registered in the system.`);
          setLoading(false);
          return;
        }
      }

      // Check if email already exists in DB
      const emailQuery = query(collection(db, "users"), where("email", "==", formData.email));
      const emailSnapshot = await getDocs(emailQuery);
      if (!emailSnapshot.empty) {
        setError(`This email address is already registered.`);
        setLoading(false);
        return;
      }

      // Generate 6-Digit Secure OTP
      const secureOtp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(secureOtp);

      // EmailJS Configuration
      const templateParams = {
        to_email: formData.email,
        to_name: formData.firstName,
        otp: secureOtp,
      };

      const SERVICE_ID = 'service_wofieis'; 
      const TEMPLATE_ID = 'template_ib469sh'; 
      const PUBLIC_KEY = 'ghRVM6FfnbkWPWTvC';

      // Send the email
      await emailjs.send(SERVICE_ID, TEMPLATE_ID, templateParams, PUBLIC_KEY);

      // Show OTP Screen
      setSuccessMsg(`Verification code sent to ${formData.email}`);
      setTimeout(() => setSuccessMsg(''), 3500);
      setShowOtpScreen(true);
      setLoading(false);

    } catch (err) {
      console.error("OTP Error:", err);
      setError("Failed to send verification email. Please check your internet connection.");
      setLoading(false);
    }
  };

  // ==========================================
  // STEP 2: VERIFY OTP & CREATE ACCOUNT
  // ==========================================
  const handleVerifyOtpAndCreateAccount = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (userOtpInput !== generatedOtp) {
      setError('Invalid Verification Code. Please check your email and try again.');
      setLoading(false);
      return;
    }

    try {
      const userCredential = await createUserWithEmailAndPassword(auth, formData.email, formData.password);
      const user = userCredential.user;

      const userProfile = {
        uid: user.uid,
        email: formData.email,
        role: selectedRole,
        firstName: formData.firstName,
        lastName: formData.lastName,
        name: `${formData.firstName} ${formData.lastName}`, 
        accountStatus: 'Pending', 
        createdAt: new Date()
      };

      if (mainCategory === 'Student') {
        userProfile.studentId = formData.studentId;
        userProfile.department = formData.department;
      } else if (mainCategory === 'Company') {
        userProfile.companyName = formData.companyName;
        userProfile.location = formData.location;
      } else if (mainCategory === 'Staff') {
        userProfile.staffId = formData.staffId;
        if (selectedRole === 'DepartmentStaff') {
          userProfile.department = formData.department;
        }
      }

      await setDoc(doc(db, "users", user.uid), userProfile);
      setSuccessMsg('Account verified and created successfully! Awaiting Administrator approval.');
      
      setTimeout(() => navigate('/login'), 3000);

    } catch (err) {
      console.error("Signup Error:", err);
      setError(getFriendlyErrorMessage(err.code));
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
                            radial-gradient(circle at 80% 70%, rgba(16, 185, 129, 0.15) 0%, transparent 40%),
                            linear-gradient(135deg, rgba(0, 26, 51, 0.98) 0%, rgba(16, 185, 129, 0.9) 100%);
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
        .role-card.active { border-color: #10B981; background: #ECFDF5; color: #064E3B; box-shadow: 0 8px 20px rgba(16, 185, 129, 0.15); }
        .role-icon { font-size: 1.5rem; margin-bottom: 8px; display: block; transition: 0.3s; color: #94A3B8; }
        .role-card.active .role-icon { transform: scale(1.1); color: #10B981; }
        .role-title { font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; text-transform: uppercase; }

        .floating-group { position: relative; margin-bottom: 1.25rem; z-index: 1; }
        .floating-input {
          width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; 
          border-radius: 12px; background: #ffffff; font-size: 0.95rem; 
          color: #1E293B; transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .floating-input:focus { border-color: #10B981; background: #ffffff; box-shadow: 0 0 0 4px rgba(16, 185, 129, 0.1); outline: none; }
        .floating-label { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.95rem; pointer-events: none; transition: all 0.2s ease; font-weight: 500; }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; font-size: 0.7rem; color: #10B981; font-weight: 800; letter-spacing: 0.5px; }

        .password-toggle { position: absolute; right: 1rem; top: 50%; transform: translateY(-50%); background: none; border: none; color: #64748B; cursor: pointer; padding: 0; z-index: 10; }
        .password-toggle:hover { color: #10B981; }

        .btn-premium { background: linear-gradient(135deg, #001A33 0%, #000E1C 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 16px 24px; font-size: 1rem; letter-spacing: 0.5px; transition: 0.3s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; z-index: 1; position: relative;}
        .btn-premium:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 26, 51, 0.3); color: white; }
        .btn-premium:disabled { opacity: 0.7; cursor: not-allowed; }
        
        .otp-input { letter-spacing: 8px; font-size: 1.5rem; text-align: center; font-weight: 800; padding: 1rem; }

        @media (max-width: 992px) {
          .auth-banner { display: none; }
          .auth-form-wrapper { padding: 3rem 2rem; }
        }

        .animate-fade-in { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="auth-container shadow-lg">
        
        {/* --- LEFT BANNER (Brand & Context) --- */}
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
            
            <h1 className="fw-bolder mb-3 display-5 lh-sm">Launch Your Professional Journey.</h1>
            <p className="fs-5 text-white-50 fw-medium lh-base pe-5">
              Join the official placement and monitoring network connecting top tech talent with industry partners.
            </p>
          </div>
          
          <div className="animate-fade-in" style={{ animationDelay: '0.3s' }}>
            <div className="d-flex align-items-center gap-3 bg-white bg-opacity-10 p-4 rounded-4 border border-white border-opacity-25" style={{ backdropFilter: 'blur(10px)' }}>
              <i className="bi bi-shield-check text-success fs-1"></i>
              <div>
                <h6 className="fw-bolder mb-1 text-white">Verified Institutional Access</h6>
                <p className="small mb-0 text-white-50 fw-medium">All student credentials and corporate accounts are strictly monitored and verified by the UIL Office.</p>
              </div>
            </div>
          </div>
        </div>

        {/* --- RIGHT PANEL (Form Area) --- */}
        <div className="auth-form-wrapper">
          
          {error && (
            <div className="alert alert-danger d-flex align-items-center rounded-3 shadow-sm mb-4 border-0 p-3 animate-fade-in flex-shrink-0" style={{ backgroundColor: '#FEF2F2', color: '#991B1B', position: 'relative', zIndex: 1 }}>
              <i className="bi bi-exclamation-octagon-fill fs-5 me-3 text-danger"></i>
              <span className="fw-bold" style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
          )}
          {successMsg && (
            <div className="alert alert-success d-flex align-items-center rounded-3 shadow-sm mb-4 border-0 p-3 animate-fade-in flex-shrink-0" style={{ backgroundColor: '#F0FDF4', color: '#166534', position: 'relative', zIndex: 1 }}>
              <i className="bi bi-check-circle-fill fs-5 me-3 text-success"></i>
              <span className="fw-bold" style={{ fontSize: '0.85rem' }}>{successMsg}</span>
            </div>
          )}

          {/* ========================================== */}
          {/* OTP VERIFICATION SCREEN */}
          {/* ========================================== */}
          {showOtpScreen ? (
            <div className="d-flex flex-column justify-content-center flex-grow-1 animate-fade-in text-center">
              <div className="mb-4">
                <div className="d-inline-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success rounded-circle mb-3" style={{ width: '80px', height: '80px' }}>
                  <i className="bi bi-envelope-check-fill fs-1"></i>
                </div>
                <h2 className="fw-bolder text-dark mb-2">Verify Your Identity</h2>
                <p className="text-muted fw-medium small mb-0 px-3">
                  For security purposes, we've sent a 6-digit verification code to <br/>
                  <strong className="text-dark">{formData.email}</strong>.
                </p>
              </div>

              <form onSubmit={handleVerifyOtpAndCreateAccount} className="px-md-4">
                <div className="floating-group mb-4">
                  <input 
                    type="text" 
                    className="floating-input otp-input" 
                    placeholder="------" 
                    maxLength="6"
                    value={userOtpInput} 
                    onChange={(e) => setUserOtpInput(e.target.value.replace(/[^0-9]/g, ''))} 
                    required 
                  />
                </div>

                <button type="submit" className="btn-premium mb-3" disabled={loading || userOtpInput.length !== 6} style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
                  {loading ? (
                    <><span className="spinner-border spinner-border-sm me-2"></span> VERIFYING...</>
                  ) : (
                    <><i className="bi bi-shield-lock-fill me-2 fs-5"></i> VERIFY & COMPLETE REGISTRATION</>
                  )}
                </button>

                <button type="button" className="btn btn-link text-muted text-decoration-none fw-bold small" onClick={() => setShowOtpScreen(false)} disabled={loading}>
                  <i className="bi bi-arrow-left me-1"></i> Back to Registration Form
                </button>
              </form>
            </div>
          ) : (

          /* ========================================== */
          /* STANDARD REGISTRATION SCREEN */
          /* ========================================== */
          <>
            <div className="mb-4 animate-fade-in" style={{ position: 'relative', zIndex: 1 }}>
              <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Sign Up</h2>
              <p className="text-muted fw-medium small">Complete the form to create your account.</p>
            </div>

            <form onSubmit={handleInitiateSignup} style={{ position: 'relative', zIndex: 1 }}>
              
              {/* VISUAL ROLE SELECTOR */}
              <div className="role-grid animate-fade-in" style={{ animationDelay: '0.1s' }}>
                <div className={`role-card ${mainCategory === 'Student' ? 'active' : ''}`} onClick={() => setMainCategory('Student')}>
                  <i className="bi bi-mortarboard-fill role-icon"></i>
                  <div className="role-title">Student</div>
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

              {/* NAME FIELDS */}
              <div className="row g-2 animate-fade-in" style={{ animationDelay: '0.15s' }}>
                <div className="col-6">
                  <div className="floating-group">
                    <input type="text" name="firstName" className="floating-input" placeholder=" " value={formData.firstName} onChange={handleChange} required />
                    <label className="floating-label">First Name</label>
                  </div>
                </div>
                <div className="col-6">
                  <div className="floating-group">
                    <input type="text" name="lastName" className="floating-input" placeholder=" " value={formData.lastName} onChange={handleChange} required />
                    <label className="floating-label">Last Name</label>
                  </div>
                </div>
              </div>

              {/* EMAIL & PASSWORD FIELDS */}
              <div className="floating-group animate-fade-in" style={{ animationDelay: '0.2s' }}>
                <input type="email" name="email" className="floating-input" placeholder=" " value={formData.email} onChange={handleChange} required />
                <label className="floating-label"> Email Address</label>
              </div>

              <div className="floating-group animate-fade-in" style={{ animationDelay: '0.25s' }}>
                <input type={showPassword ? "text" : "password"} name="password" className="floating-input" placeholder=" " value={formData.password} onChange={handleChange} required minLength="6" />
                <label className="floating-label">Password (Min 6 chars)</label>
                <button type="button" className="password-toggle" onClick={() => setShowPassword(!showPassword)} tabIndex="-1">
                  <i className={`bi ${showPassword ? 'bi-eye-slash-fill' : 'bi-eye-fill'} fs-5`}></i>
                </button>
              </div>

              {/* DYNAMIC CONTEXT FIELDS */}
              {mainCategory === 'Student' && (
                <div className="row g-2 animate-fade-in border-start border-success border-4 ps-2 mb-2 ms-1" style={{ animationDelay: '0.3s' }}>
                  <div className="col-6">
                    <div className="floating-group mb-0">
                      <input type="text" name="studentId" className="floating-input fw-bolder text-success" placeholder=" " value={formData.studentId} onChange={handleChange} required />
                      <label className="floating-label">Student ID (0000/YY)</label>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="floating-group mb-0">
                      <select name="department" className="floating-input fw-bold bg-white" style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'pointer' }} value={formData.department} onChange={handleChange} required>
                        <option value="" disabled>Select Dept...</option>
                        <option value="Information Systems">Information Systems</option>
                        <option value="Information Technology">Information Technology</option>
                        <option value="Computer Science">Computer Science</option>
                      </select>
                      <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#10B981' }}>Department</label>
                      <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                    </div>
                  </div>
                </div>
              )}

              {mainCategory === 'Company' && (
                <div className="row g-2 animate-fade-in border-start border-success border-4 ps-2 mb-2 ms-1" style={{ animationDelay: '0.3s' }}>
                  <div className="col-6">
                    <div className="floating-group mb-0">
                      <input type="text" name="companyName" className="floating-input" placeholder=" " value={formData.companyName} onChange={handleChange} required />
                      <label className="floating-label">Organization Name</label>
                    </div>
                  </div>
                  <div className="col-6">
                    <div className="floating-group mb-0">
                      <input type="text" name="location" className="floating-input" placeholder=" " value={formData.location} onChange={handleChange} required />
                      <label className="floating-label">City / Location</label>
                    </div>
                  </div>
                </div>
              )}

              {mainCategory === 'Staff' && (
                <div className="animate-fade-in border-start border-success border-4 ps-2 mb-2 ms-1" style={{ animationDelay: '0.3s' }}>
                  <div className="floating-group mb-3">
                    <input type="text" name="staffId" className="floating-input" placeholder=" " value={formData.staffId} onChange={handleChange} required />
                    <label className="floating-label">Official Staff ID</label>
                  </div>
                  <p className="text-muted fw-bold small mb-2 ms-1">Please select your primary staff designation:</p>
                  <div className="floating-group">
                    <select className="floating-input fw-bold text-success" name="role" style={{ appearance: 'none', cursor: 'pointer', backgroundColor: '#ECFDF5', borderColor: '#A7F3D0' }} value={selectedRole} onChange={(e) => {setSelectedRole(e.target.value); setError('');}}>
                      <option value="DepartmentStaff">Department Placement Officer</option>
                      <option value="FacultyOfficer">Faculty Clearance Officer</option>
                      <option value="UILOfficer">UIL Office Administrator</option>
                      <option value="FinanceOfficer">Finance Disbursing Officer</option>
                      <option value="DeputyDirector">Deputy Director (Executive)</option>
                    </select>
                    <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#065F46', fontWeight: '800' }}>Access Level Authorization</label>
                    <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#10B981' }}></i>
                  </div>
                </div>
              )}

              {/* DYNAMIC DEPARTMENT SELECTOR FOR DEPARTMENT STAFF */}
              {mainCategory === 'Staff' && selectedRole === 'DepartmentStaff' && (
                <div className="floating-group animate-fade-in border-start border-success border-4 ps-2 mb-2 ms-1" style={{ animationDelay: '0.35s' }}>
                  <select name="department" className="floating-input fw-bold bg-white" style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'pointer' }} value={formData.department} onChange={handleChange} required>
                    <option value="" disabled>Select Department...</option>
                    <option value="Information Systems">Information Systems</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                  <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#10B981' }}>Designated Unit</label>
                  <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                </div>
              )}

              <button type="submit" className="btn-premium mt-3 animate-fade-in" style={{ animationDelay: '0.35s' }} disabled={loading}>
                {loading ? (
                  <><span className="spinner-border spinner-border-sm me-2"></span> INITIALIZING...</>
                ) : (
                  <><i className="bi bi-person-plus-fill me-2 fs-5"></i> PROCEED TO VERIFICATION</>
                )}
              </button>
              
              <div className="text-center mt-4 pt-3 border-top animate-fade-in" style={{ animationDelay: '0.4s' }}>
                <span className="text-muted fw-medium" style={{ fontSize: '0.95rem' }}>Already possess an account? </span>
                <Link to="/login" className="text-decoration-none fw-bolder ms-1" style={{ fontSize: '0.95rem', color: '#10B981' }}>
                  Login <i className="bi bi-arrow-right-short"></i>
                </Link>
              </div>

            </form>
          </>
          )}

        </div>
      </div>
    </div>
  );
};

export default Signup;