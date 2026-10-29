import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase-config';
import { collection, onSnapshot, query, where, doc, getDoc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const CompanyDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState("Requests"); 
  const [searchTerm, setSearchTerm] = useState(""); 
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  // Bulletproof company name state
  const [companyName, setCompanyName] = useState('');

  // Evaluation Modal State
  const [showEvalModal, setShowEvalModal] = useState(false);
  const [selectedStudentForEval, setSelectedStudentForEval] = useState(null);
  const [evalForm, setEvalForm] = useState({ score: '', feedback: '' });

  const role = localStorage.getItem('role') || 'CompanyRepresentative';
  const userName = localStorage.getItem('userName') || 'Corporate Partner';
  const userId = localStorage.getItem('userId');

  // 1. Fetch Assigned Students
  useEffect(() => {
    if (!userId) return;

    const setupCompanyListener = async () => {
      try {
        const userDocRef = doc(db, "users", userId);
        const userDocSnap = await getDoc(userDocRef);
        
        if (userDocSnap.exists()) {
          const actualCompanyName = userDocSnap.data().companyName;
          setCompanyName(actualCompanyName); 
          
          if (!actualCompanyName) {
             console.error("This user profile does not have a companyName field!");
             setLoading(false);
             return;
          }

          const q = query(
            collection(db, "applications"),
            where("companyName", "==", actualCompanyName)
          );

          onSnapshot(q, (snapshot) => {
            const apps = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
            apps.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
            setApplications(apps);
            setLoading(false);
          });
        }
      } catch (error) {
        console.error("Company Sync Error:", error);
        setNotification({ type: 'danger', message: 'Failed to sync with the university portal.' });
        setLoading(false);
      }
    };

    setupCompanyListener();
  }, [userId]);

  // 2. Reject Workflow
  const handleRejectPlacement = async (appId, studentName) => {
    const isConfirmed = window.confirm(`Are you sure you want to decline ${studentName}'s placement?`);
    if (!isConfirmed) return;

    setProcessingId(appId);
    setNotification({ type: '', message: '' });

    try {
      const appRef = doc(db, "applications", appId);
      await updateDoc(appRef, { 
        status: 'RejectedByCompany', 
        decisionAt: serverTimestamp() 
      });

      setNotification({ type: 'warning', message: `You have successfully declined ${studentName}. The University has been notified.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Action failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // 3. Accept Workflow (Directly accepts the requested working area)
  const handleAcceptPlacement = async (appId, studentName, requestedArea) => {
    const isConfirmed = window.confirm(`Accept ${studentName} for the requested ${requestedArea || 'General'} role?`);
    if (!isConfirmed) return;

    setProcessingId(appId);
    setNotification({ type: '', message: '' });
    
    try {
      const appRef = doc(db, "applications", appId);
      await updateDoc(appRef, { 
        status: 'Active', 
        workingArea: requestedArea || 'General Duty', // Locks in what the student requested
        decisionAt: serverTimestamp() 
      });

      setNotification({ type: 'success', message: `Successfully accepted ${studentName} for the ${requestedArea || 'General'} role.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Acceptance failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // 4. Evaluation Workflow
  const openEvaluationModal = (studentApp) => {
    setSelectedStudentForEval(studentApp);
    setEvalForm({ score: '', feedback: '' });
    setShowEvalModal(true);
  };

  const handleSumbitEvaluation = async (e) => {
    e.preventDefault();
    setProcessingId(selectedStudentForEval.id);
    
    try {
      await addDoc(collection(db, "evaluations"), {
        assignmentId: selectedStudentForEval.id,
        studentId: selectedStudentForEval.studentId,
        companyName: companyName,
        score: parseInt(evalForm.score),
        feedback: evalForm.feedback,
        evaluatedAt: serverTimestamp()
      });

      const newStatus = selectedStudentForEval.status === 'ReportSubmitted' ? 'PendingAcademicApproval' : 'CompanyEvaluated';

      const appRef = doc(db, "applications", selectedStudentForEval.id);
      await updateDoc(appRef, { 
        status: newStatus,
        companyScore: parseInt(evalForm.score),
        companyReport: evalForm.feedback,
        companyEvaluatedAt: serverTimestamp()
      });

      setNotification({ type: 'success', message: `Evaluation for ${selectedStudentForEval.studentName} securely submitted to the University.` });
      setShowEvalModal(false);
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Evaluation failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // Derived Analytics & Filtering
  const filteredApps = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return applications.filter(a => 
      (a.studentName?.toLowerCase() || '').includes(lowerSearch) ||
      (a.studentId?.toLowerCase() || '').includes(lowerSearch) ||
      (a.requestedWorkingArea?.toLowerCase() || '').includes(lowerSearch)
    );
  }, [applications, searchTerm]);

  const pendingRequests = filteredApps.filter(a => a.status === 'Assigned');
  const activeInterns = filteredApps.filter(a => a.status === 'Active' || a.status === 'ReportSubmitted');
  const completedInterns = filteredApps.filter(a => ['CompanyEvaluated', 'PendingAcademicApproval', 'AcademicallyApproved', 'FinanceProcessed', 'Completed'].includes(a.status));

  return (
    <Layout role={role} userName={userName}>
      
      <style>{`
        .company-header { margin-bottom: 2rem; }
        
        .metric-card {
          background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px;
          padding: 1.5rem; display: flex; align-items: center; gap: 1rem;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.3s ease;
        }
        .metric-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .metric-icon {
          width: 54px; height: 54px; border-radius: 14px; display: flex;
          align-items: center; justify-content: center; font-size: 1.5rem;
        }

        .controls-bar {
          background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px;
          padding: 12px 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between;
          align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 1rem;
        }
        
        .segment-btn {
          padding: 8px 24px; border-radius: 10px; font-weight: 700; font-size: 0.85rem;
          border: none; background: transparent; color: #64748B; transition: all 0.2s ease;
        }
        .segment-btn.active { background: #001A33; color: #ffffff; box-shadow: 0 4px 12px rgba(0, 26, 51, 0.2); }

        .search-input-wrapper { position: relative; width: 280px; }
        .search-input-wrapper i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94A3B8; }
        .search-input {
          width: 100%; padding: 10px 16px 10px 42px; border-radius: 12px;
          border: 1px solid #E2E8F0; background: #F8FAFC; font-size: 0.9rem; transition: 0.3s;
        }
        .search-input:focus { background: #ffffff; border-color: #0055FF; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }

        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: #F8FAFC; color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
        .premium-table tbody tr { transition: background 0.2s ease; }
        .premium-table tbody tr:hover { background: #F8FAFC; }
        
        .btn-action { font-weight: 700; border: none; border-radius: 10px; padding: 8px 20px; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 6px; }
        .btn-accept { background: #10B981; color: white; }
        .btn-accept:hover:not(:disabled) { background: #059669; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3); }
        .btn-reject { background: #EF4444; color: white; }
        .btn-reject:hover:not(:disabled) { background: #DC2626; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(239, 68, 68, 0.3); }
        .btn-evaluate { background: #0055FF; color: white; }
        .btn-evaluate:hover:not(:disabled) { background: #0044CC; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0, 85, 255, 0.3); }

        .avatar-initial {
          width: 42px; height: 42px; border-radius: 50%; background: #EFF6FF;
          color: #2563EB; display: flex; align-items: center; justify-content: center;
          font-weight: 800; font-size: 1.1rem; border: 1px solid #BFDBFE; flex-shrink: 0;
        }

        .glass-modal { background: rgba(255, 255, 255, 0.98); backdrop-filter: blur(20px); border: 1px solid rgba(255,255,255,0.5); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.2); }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0, 14, 28, 0.6); backdrop-filter: blur(4px); z-index: 1050; display: flex; align-items: center; justify-content: center; animation: fadeIn 0.3s ease; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        
        .animate-fade-in { animation: slideUpFade 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }

        .floating-input { width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; border-radius: 12px; background: #F8FAFC; font-size: 0.95rem; color: #1E293B; transition: 0.2s; }
        .floating-input:focus { border-color: #0055FF; background: #fff; box-shadow: 0 0 0 4px rgba(0,85,255,0.1); outline: none; }
        .floating-label { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.95rem; pointer-events: none; transition: 0.2s; font-weight: 500; }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; font-size: 0.7rem; color: #0055FF; font-weight: 700; letter-spacing: 0.5px; }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="company-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3">
        <div>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>{companyName || 'Corporate'} Partner Portal</h2>
          <p className="text-muted mb-0 fw-medium">Review placement requests and manage active intern evaluations.</p>
        </div>
        <button className="btn btn-outline-primary border-2 fw-bold rounded-3 px-4 py-2 shadow-sm d-flex align-items-center gap-2" onClick={() => window.print()}>
          <i className="bi bi-printer-fill"></i> Export Intern Roster
        </button>
      </div>

      {/* --- NOTIFICATIONS --- */}
      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade-in`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-warning'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {/* --- EXECUTIVE METRICS --- */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="metric-card">
            <div className="metric-icon bg-warning bg-opacity-10 text-warning"><i className="bi bi-person-lines-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Pending Assignments</p>
              <h2 className="fw-bolder mb-0 text-dark">{pendingRequests.length}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="metric-card">
            <div className="metric-icon bg-primary bg-opacity-10 text-primary"><i className="bi bi-briefcase-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Active Interns</p>
              <h2 className="fw-bolder mb-0 text-dark">{activeInterns.length}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="metric-card">
            <div className="metric-icon bg-success bg-opacity-10 text-success"><i className="bi bi-star-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Evaluations Submitted</p>
              <h2 className="fw-bolder mb-0 text-dark">{completedInterns.length}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* --- CONTROLS BAR (With Search) --- */}
      <div className="controls-bar">
        <div className="d-flex gap-2">
          <button className={`segment-btn ${activeTab === 'Requests' ? 'active' : ''}`} onClick={() => setActiveTab('Requests')}>
            Placement Requests {pendingRequests.length > 0 && <span className="badge bg-danger rounded-pill ms-2">{pendingRequests.length}</span>}
          </button>
          <button className={`segment-btn ${activeTab === 'Evaluations' ? 'active' : ''}`} onClick={() => setActiveTab('Evaluations')}>
            Active Interns & Evaluations
          </button>
        </div>
        <div className="search-input-wrapper">
          <i className="bi bi-search"></i>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search interns by name..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* --- DATA GRIDS --- */}
      <div className="premium-table table-responsive mb-5 animate-fade-in">
        <table className="table align-middle mb-0">
          
          {/* TAB 1: PLACEMENT REQUESTS */}
          {activeTab === 'Requests' ? (
            <>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Candidate Profile</th>
                  <th style={{ width: '25%' }}>Academic Dept</th>
                  <th style={{ width: '25%' }}>Requested Role</th>
                  <th className="text-end" style={{ width: '20%' }}>Decision</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr> : pendingRequests.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5">
                      <i className="bi bi-inbox text-muted fs-1 opacity-50 mb-3 d-block"></i>
                      <h5 className="text-dark fw-bold">Inbox Empty</h5>
                      <p className="text-muted small mb-0">No pending placement requests from the University at this time.</p>
                    </td>
                  </tr>
                ) : pendingRequests.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <div className="avatar-initial">{app.studentName?.charAt(0).toUpperCase() || 'S'}</div>
                        <div>
                          <div className="fw-bolder text-dark">{app.studentName}</div>
                          <div className="small text-muted font-monospace mt-1">ID: {app.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="badge bg-light text-dark border px-3 py-2 rounded-pill fw-bold">{app.department}</span></td>
                    
                    {/* View the Requested Working Area directly on the table */}
                    <td>
                      <span className="fw-bold text-primary">
                        <i className="bi bi-diagram-3 me-2"></i>
                        {app.requestedWorkingArea || 'Not Specified'}
                      </span>
                    </td>
                    
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button className="btn-action btn-reject" onClick={() => handleRejectPlacement(app.id, app.studentName)} disabled={processingId === app.id}>
                          <i className="bi bi-x-lg"></i> Decline
                        </button>
                        <button className="btn-action btn-accept" onClick={() => handleAcceptPlacement(app.id, app.studentName, app.requestedWorkingArea)} disabled={processingId === app.id}>
                          <i className="bi bi-check-lg"></i> Accept
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          ) : (
            
            // TAB 2: ACTIVE INTERNS & EVALUATIONS
            <>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Intern Profile</th>
                  <th style={{ width: '25%' }}>Assigned Division</th>
                  <th style={{ width: '25%' }}>Internship Status</th>
                  <th className="text-end" style={{ width: '20%' }}>Performance Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr> : (activeInterns.length === 0 && completedInterns.length === 0) ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5">
                      <i className="bi bi-people text-muted fs-1 opacity-50 mb-3 d-block"></i>
                      <h5 className="text-dark fw-bold">No Active Interns</h5>
                      <p className="text-muted small mb-0">Accept placement requests to populate your roster.</p>
                    </td>
                  </tr>
                ) : [...activeInterns, ...completedInterns].map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <div className="avatar-initial">{app.studentName?.charAt(0).toUpperCase() || 'S'}</div>
                        <div>
                          <div className="fw-bolder text-dark">{app.studentName}</div>
                          <div className="small text-muted font-monospace mt-1">ID: {app.studentId}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="fw-bold text-primary"><i className="bi bi-diagram-3 me-2"></i>{app.workingArea || 'General Duty'}</span>
                    </td>
                    <td>
                      {app.status === 'Active' || app.status === 'ReportSubmitted' ? (
                        <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-3 py-2 rounded-pill">In Progress</span>
                      ) : (
                        <span className="badge bg-success bg-opacity-10 text-success border border-success px-3 py-2 rounded-pill"><i className="bi bi-check-circle-fill me-1"></i> Evaluated ({app.companyScore}/100)</span>
                      )}
                    </td>
                    <td className="text-end">
                      {app.status === 'Active' || app.status === 'ReportSubmitted' ? (
                        <button className="btn-action btn-evaluate" onClick={() => openEvaluationModal(app)}>
                          <i className="bi bi-clipboard2-data-fill"></i> Grade Intern
                        </button>
                      ) : (
                        <span className="text-muted small fw-bold px-3 py-2 bg-light rounded-pill"><i className="bi bi-lock-fill"></i> Finalized</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </>
          )}
        </table>
      </div>

      {/* --- EVALUATION MODAL --- */}
      {showEvalModal && selectedStudentForEval && (
        <div className="modal-overlay">
          <div className="glass-modal p-4 p-md-5" style={{ width: '100%', maxWidth: '500px' }}>
            
            <div className="d-flex justify-content-between align-items-center mb-4">
              <div>
                <h3 className="fw-bolder text-dark mb-1">Intern Evaluation</h3>
                <p className="text-muted small mb-0">Submitting formal review for <strong>{selectedStudentForEval.studentName}</strong></p>
              </div>
              <button type="button" className="btn btn-light rounded-circle" onClick={() => setShowEvalModal(false)}><i className="bi bi-x-lg"></i></button>
            </div>

            <form onSubmit={handleSumbitEvaluation}>
              <div className="position-relative mb-3">
                <input 
                  type="number" 
                  className="floating-input fw-bold text-primary fs-4" 
                  min="0" max="100" 
                  placeholder=" " 
                  value={evalForm.score} 
                  onChange={(e) => setEvalForm({...evalForm, score: e.target.value})} 
                  required 
                />
                <label className="floating-label">Overall Performance Score (0-100)</label>
              </div>

              <div className="position-relative mb-4">
                <textarea 
                  className="floating-input" 
                  rows="4" 
                  placeholder=" " 
                  value={evalForm.feedback} 
                  onChange={(e) => setEvalForm({...evalForm, feedback: e.target.value})} 
                  required 
                  style={{ resize: 'none' }}
                ></textarea>
                <label className="floating-label">Professional Feedback & Remarks</label>
              </div>

              <div className="d-flex gap-2">
                <button type="button" className="btn btn-light fw-bold w-50 py-3 rounded-3" onClick={() => setShowEvalModal(false)}>Cancel</button>
                <button type="submit" className="btn-action btn-evaluate w-50 py-3 rounded-3 fs-6 justify-content-center" disabled={processingId === selectedStudentForEval.id}>
                  {processingId === selectedStudentForEval.id ? <span className="spinner-border spinner-border-sm"></span> : 'Submit Evaluation'}
                </button>
              </div>
            </form>
            
          </div>
        </div>
      )}

    </Layout>
  );
};

export default CompanyDashboard;