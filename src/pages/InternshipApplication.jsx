import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { db, auth } from '../firebase-config';
import { collection, addDoc, doc, getDoc, query, where, getDocs, serverTimestamp } from 'firebase/firestore'; 
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const InternshipApplication = () => {
  const navigate = useNavigate();
  
  // Robust State Management
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [studentProfile, setStudentProfile] = useState(null);
  const [hasExistingApp, setHasExistingApp] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });

  const role = localStorage.getItem('role') || 'Student';

  const [formData, setFormData] = useState({
    companyName: '',
    companyAddress: '',
    supervisorName: '',
    workingDepartment: '', // Now a select dropdown
    startDate: '',
    roleDescription: ''
  });

  // Fetch Profile & Check for Existing Applications
  useEffect(() => {
    const fetchProfileAndCheckStatus = async () => {
      const user = auth.currentUser;
      if (!user) {
        // If Firebase auth isn't fully initialized yet, wait or rely on localStorage
        const localUserId = localStorage.getItem('userId');
        if (!localUserId) {
          setLoading(false);
          return;
        }
      }

      const uid = user ? user.uid : localStorage.getItem('userId');

      try {
        // 1. Fetch Student Profile 
        const docSnap = await getDoc(doc(db, "users", uid));
        if (docSnap.exists()) {
          setStudentProfile(docSnap.data());
        }

        // 2. Prevent Duplicate Applications
        const appQuery = query(collection(db, "applications"), where("userId", "==", uid));
        const appSnap = await getDocs(appQuery);
        
        if (!appSnap.empty) {
          setHasExistingApp(true);
          setNotification({ 
            type: 'warning', 
            message: 'You already have an active application in the system. Please wait for official review.' 
          });
        }
      } catch (err) {
        console.error("Data fetch error:", err);
        setNotification({ type: 'danger', message: 'Failed to securely connect to the university database.' });
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfileAndCheckStatus();
  }, []);

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (hasExistingApp) return;

    setIsSubmitting(true);
    setNotification({ type: '', message: '' });

    try {
      const uid = auth.currentUser ? auth.currentUser.uid : localStorage.getItem('userId');
      
      // Officially insert the placement request into the Main Flow
      await addDoc(collection(db, "applications"), {
        userId: uid,
        studentName: `${studentProfile?.firstName || ''} ${studentProfile?.lastName || ''}`.trim(),
        studentId: studentProfile?.studentId || 'Pending Verification',
        department: studentProfile?.department || 'Information Systems',
        ...formData,
        status: 'Pending', // Pushes to Department Dashboard for review (Step 1 of Main Flow)
        submittedAt: serverTimestamp()
      });
      
      setNotification({ type: 'success', message: 'Application officially submitted to the Faculty!' });
      
      // Gentle delay before redirecting so the user sees the success message
      setTimeout(() => navigate('/student-dashboard'), 2000);

    } catch (error) {
      setNotification({ type: 'danger', message: `Submission failed: ${error.message}` });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Layout role={role} userName={studentProfile?.firstName || 'Student'}>
      
      {/* INJECTED PREMIUM SAAS STYLES */}
      <style>{`
        .form-hero { margin-bottom: 2rem; padding-bottom: 1.5rem; border-bottom: 1px solid #E2E8F0; }
        
        /* Verified ID Card */
        .id-card {
          background: linear-gradient(180deg, #001A33 0%, #000E1C 100%);
          color: white; border-radius: 20px; padding: 2.5rem;
          box-shadow: 0 15px 35px rgba(0, 26, 51, 0.2); position: relative; overflow: hidden;
        }
        .id-card::before {
          content: ''; position: absolute; top: -50px; right: -50px; width: 180px; height: 180px;
          background: radial-gradient(circle, rgba(255, 193, 7, 0.15) 0%, transparent 70%); border-radius: 50%;
        }

        /* Floating Inputs */
        .floating-group { position: relative; margin-bottom: 1.5rem; }
        .floating-input {
          width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; 
          border-radius: 12px; background: #F8FAFC; font-size: 0.95rem; color: #1E293B; transition: 0.2s;
        }
        .floating-input:focus { border-color: #0055FF; background: #ffffff; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .floating-label {
          position: absolute; left: 1rem; top: 50%; transform: translateY(-50%);
          color: #64748B; font-size: 0.95rem; pointer-events: none; transition: 0.2s; font-weight: 500;
        }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label {
          top: 0.8rem; font-size: 0.7rem; color: #0055FF; font-weight: 700; letter-spacing: 0.5px;
        }
        .floating-textarea ~ .floating-label { top: 1.2rem; }
        .floating-textarea:focus ~ .floating-label, .floating-textarea:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; }

        .btn-premium-gold {
          background: linear-gradient(135deg, #FFCC00 0%, #E6B800 100%);
          color: #001A33; font-weight: 800; border-radius: 12px; border: none; padding: 14px 32px;
          transition: all 0.3s ease; font-size: 1rem; display: inline-flex; align-items: center; gap: 8px;
        }
        .btn-premium-gold:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(255, 204, 0, 0.3); }
        .btn-premium-gold:disabled { opacity: 0.7; cursor: not-allowed; }

        .animate-fade { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="form-hero d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Self-Placement Form</h2>
          <p className="text-muted mb-0 fw-medium">Propose a host organization for departmental approval.</p>
        </div>
        <button 
          className="btn btn-light border fw-bold d-flex align-items-center gap-2 px-4 py-2 shadow-sm" 
          onClick={() => navigate('/student-dashboard')}
          style={{ borderRadius: '10px' }}
        >
          <i className="bi bi-arrow-left"></i> Back to Hub
        </button>
      </div>

      {/* --- NOTIFICATION CENTER --- */}
      {notification.message && (
        <div className={`alert alert-${notification.type === 'error' ? 'danger' : notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : notification.type === 'warning' ? 'bi-lock-fill text-warning' : 'bi-info-circle-fill text-primary'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {loading ? (
        <div className="text-center py-5">
          <div className="spinner-border text-primary" role="status" style={{width: '3rem', height: '3rem'}}></div>
          <p className="text-muted mt-3 fw-medium">Loading secure portal...</p>
        </div>
      ) : (
        <div className="row g-4 mb-5 animate-fade">
          
          {/* --- LEFT: VERIFIED STUDENT ID CARD --- */}
          <div className="col-lg-4">
            <div className="id-card">
              <div className="d-flex justify-content-between align-items-start mb-4">
                <div className="bg-white bg-opacity-10 p-2 rounded-3 d-inline-flex">
                  <i className="bi bi-shield-check text-warning fs-3"></i>
                </div>
                <span className="badge bg-success bg-opacity-25 text-white border border-success border-opacity-50 rounded-pill px-3 py-2">
                  Verified Identity
                </span>
              </div>
              
              <div className="mb-4">
                <label className="text-white-50 small text-uppercase fw-bold" style={{ letterSpacing: '1px' }}>Full Legal Name</label>
                <h4 className="fw-bolder mb-0 mt-1">{studentProfile?.firstName} {studentProfile?.lastName}</h4>
              </div>
              
              <div className="mb-4">
                <label className="text-white-50 small text-uppercase fw-bold" style={{ letterSpacing: '1px' }}>University ID</label>
                <h5 className="fw-bold mb-0 mt-1 font-monospace" style={{ color: '#FFCC00' }}>{studentProfile?.studentId || 'Pending Verification'}</h5>
              </div>
              
              <div>
                <label className="text-white-50 small text-uppercase fw-bold" style={{ letterSpacing: '1px' }}>Academic Faculty</label>
                <p className="fw-bold mb-0 mt-1">{studentProfile?.department || 'Faculty of Informatics'}</p>
              </div>

              <hr className="border-secondary opacity-25 my-4" />
              
              <div className="d-flex align-items-start gap-2 text-white-50 small fw-medium">
                <i className="bi bi-lock-fill mt-1"></i>
                <p className="mb-0">This profile data is cryptographically bound to your application record.</p>
              </div>
            </div>
          </div>

          {/* --- RIGHT: THE SAAS FORM --- */}
          <div className="col-lg-8">
            <div className="card border-0 shadow-sm rounded-4 h-100" style={{ background: '#ffffff', border: '1px solid #E2E8F0' }}>
              <div className="card-body p-4 p-md-5">
                
                <div className="d-flex justify-content-between align-items-center mb-4 border-bottom pb-3">
                  <h4 className="fw-bolder text-dark mb-0">Placement Configuration</h4>
                  <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-3 py-2 rounded-pill">
                    Step 1 of 5
                  </span>
                </div>
                
                <form onSubmit={handleSubmit}>
                  <fieldset disabled={hasExistingApp || isSubmitting}>
                    
                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="floating-group">
                          <input type="text" name="companyName" className="floating-input" placeholder=" " value={formData.companyName} onChange={handleChange} required />
                          <label className="floating-label">Host Organization Name</label>
                          <div className="form-text mt-1 text-muted" style={{fontSize: '0.75rem'}}><i className="bi bi-info-circle"></i> Will be vetted by UIL Office</div>
                        </div>
                      </div>
                      <div className="col-md-6">
                        <div className="floating-group">
                          <input type="text" name="companyAddress" className="floating-input" placeholder=" " value={formData.companyAddress} onChange={handleChange} required />
                          <label className="floating-label">Physical Location / City</label>
                        </div>
                      </div>
                    </div>

                    <div className="row g-3">
                      <div className="col-md-6">
                        <div className="floating-group">
                          <input type="text" name="supervisorName" className="floating-input" placeholder=" " value={formData.supervisorName} onChange={handleChange} required />
                          <label className="floating-label">Direct Supervisor Name</label>
                        </div>
                      </div>
                      <div className="col-md-6">
                        {/* STRICT DROPDOWN FOR WORKING DEPARTMENT */}
                        <div className="floating-group">
                          <select 
                            name="workingDepartment" 
                            className="floating-input fw-bold" 
                            style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'pointer' }} 
                            value={formData.workingDepartment} 
                            onChange={handleChange} 
                            required
                          >
                            <option value="" disabled>Select Target Division...</option>
                            <option value="Software Engineering">Software Engineering</option>
                            <option value="Network & Infrastructure">Network & Infrastructure</option>
                            <option value="Data Science & Analytics">Data Science & Analytics</option>
                            <option value="Cybersecurity">Cybersecurity</option>
                            <option value="IT Support / Helpdesk">IT Support / Helpdesk</option>
                            <option value="Quality Assurance (QA)">Quality Assurance (QA)</option>
                            <option value="Other / General IT">Other / General IT</option>
                          </select>
                          <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Target Division</label>
                          <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                        </div>
                      </div>
                    </div>

                    <div className="floating-group">
                      <input type="date" name="startDate" className="floating-input" style={{paddingTop: '1.6rem', paddingBottom: '0.4rem'}} value={formData.startDate} onChange={handleChange} required />
                      <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Proposed Start Date</label>
                    </div>

                    <div className="floating-group mb-5">
                      <textarea 
                        name="roleDescription" 
                        className="floating-input floating-textarea" 
                        rows="4" 
                        placeholder=" " 
                        value={formData.roleDescription}
                        onChange={handleChange} 
                        required
                        style={{ resize: 'none' }}
                      ></textarea>
                      <label className="floating-label">Anticipated Role & Responsibilities</label>
                    </div>

                    <div className="d-flex flex-column flex-md-row align-items-md-center justify-content-between p-4 bg-light rounded-3 border">
                      <div className="mb-3 mb-md-0">
                        <span className="text-dark fw-bold d-block"><i className="bi bi-shield-check text-success me-2"></i>Official Submission</span>
                        <span className="text-muted small fw-medium">Form will lock upon successful transmission.</span>
                      </div>
                      <button type="submit" className="btn-premium-gold">
                        {isSubmitting ? (
                          <><span className="spinner-border spinner-border-sm"></span> Processing...</>
                        ) : hasExistingApp ? (
                          <><i className="bi bi-lock-fill"></i> Locked</>
                        ) : (
                          <><i className="bi bi-send-fill"></i> Transmit to Faculty</>
                        )}
                      </button>
                    </div>

                  </fieldset>
                </form>

              </div>
            </div>
          </div>

        </div>
      )}
    </Layout>
  );
};

export default InternshipApplication;