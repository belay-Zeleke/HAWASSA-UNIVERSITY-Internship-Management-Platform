import React, { useState, useEffect } from 'react';
import { db } from '../firebase-config';
import { collection, addDoc, query, where, getDocs, onSnapshot } from 'firebase/firestore'; 
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const StudentLogbook = () => {
  const [logs, setLogs] = useState([]);
  const [applicationStatus, setApplicationStatus] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  const [newLog, setNewLog] = useState({
    weekNumber: '', startDate: '', endDate: '', description: '', hours: ''
  });

  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || 'Student';
  const role = localStorage.getItem('role') || 'Student';

  // 1. Fetch Student Application Status & Logbook Data
  useEffect(() => {
    if (!userId) {
      setLoading(false);
      return;
    }

    const checkStatus = async () => {
      try {
        const qApp = query(collection(db, "applications"), where("userId", "==", userId));
        const appSnapshot = await getDocs(qApp);
        if (!appSnapshot.empty) {
          setApplicationStatus(appSnapshot.docs[0].data().status);
        }
      } catch (error) {
        console.error("Error fetching status:", error);
      }
    };
    
    checkStatus();

    const qLogs = query(collection(db, "logbooks"), where("studentId", "==", userId));
    const unsubscribe = onSnapshot(qLogs, (snapshot) => {
      const fetchedLogs = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      })).sort((a, b) => Number(b.weekNumber) - Number(a.weekNumber)); 

      setLogs(fetchedLogs);
      setLoading(false);
    }, (error) => {
      console.error("Error fetching logs:", error);
      setNotification({ type: 'danger', message: 'Failed to synchronize logbook with server.' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, [userId]);

  // Derived Analytics
  const totalHours = logs.reduce((sum, log) => sum + Number(log.hours || 0), 0);
  const approvedCount = logs.filter(log => log.status === 'Approved').length;
  const pendingCount = logs.filter(log => log.status === 'Submitted' || log.status === 'Pending').length;

  // Verify if the student is legally allowed to log hours based on the Main Flow
  const isInternshipActive = applicationStatus && ['Active', 'CompanyEvaluated', 'ReportSubmitted', 'PendingAcademicApproval', 'AcademicallyApproved', 'FinanceProcessed', 'Completed'].includes(applicationStatus);

  // 2. Submit Log Entry
  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    setNotification({ type: '', message: '' });

    try {
      await addDoc(collection(db, "logbooks"), {
        studentId: userId,
        studentName: userName,
        weekNumber: Number(newLog.weekNumber),
        startDate: newLog.startDate,
        endDate: newLog.endDate,
        description: newLog.description,
        hours: Number(newLog.hours),
        status: 'Submitted', 
        submittedAt: new Date()
      });

      setShowModal(false);
      setNewLog({ weekNumber: '', startDate: '', endDate: '', description: '', hours: '' });
      setNotification({ type: 'success', message: `Week ${newLog.weekNumber} log successfully submitted for review.` });
      
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (error) {
      setNotification({ type: 'danger', message: error.message });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <Layout role={role} userName={userName}><div className="text-center py-5"><div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}}></div></div></Layout>;
  }

  return (
    <Layout role={role} userName={userName}>
      
      <style>{`
        :root { --primary-blue: #0055FF; --bg-soft: #F8FAFC; }

        .page-header { margin-bottom: 2.5rem; }
        
        .metric-card {
          background: #ffffff; border: 1px solid #E2E8F0; border-radius: 20px;
          padding: 1.5rem; transition: all 0.3s ease; box-shadow: 0 4px 12px rgba(0,0,0,0.02);
          position: relative; overflow: hidden; display: flex; align-items: center; gap: 1.2rem;
        }
        .metric-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .metric-icon { width: 56px; height: 56px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; }
        
        .premium-table { background: #ffffff; border-radius: 20px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1.2rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
        .premium-table tbody tr { transition: background-color 0.2s ease; }
        .premium-table tbody tr:hover td { background-color: var(--bg-soft); }

        .status-pill { padding: 6px 16px; border-radius: 50px; font-size: 0.75rem; font-weight: 800; letter-spacing: 0.5px; display: inline-flex; align-items: center; gap: 6px; box-shadow: 0 2px 4px rgba(0,0,0,0.02); }
        .status-submitted { background: #FFFBEB; color: #D97706; border: 1px solid #FDE68A; }
        .status-approved { background: #ECFDF5; color: #059669; border: 1px solid #6EE7B7; }
        .status-rejected { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }

        /* MODAL STYLES */
        .glass-overlay { position: fixed; inset: 0; background: rgba(0, 14, 28, 0.6); backdrop-filter: blur(8px); z-index: 1050; display: flex; align-items: center; justify-content: center; padding: 1rem; animation: fadeIn 0.3s ease; }
        .glass-modal { background: rgba(255, 255, 255, 0.98); border: 1px solid rgba(255,255,255,0.8); border-radius: 24px; box-shadow: 0 24px 80px rgba(0,0,0,0.2); width: 100%; max-width: 650px; overflow: hidden; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); }
        
        /* FLOATING INPUTS */
        .floating-group { position: relative; margin-bottom: 1.5rem; }
        .floating-input { width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; border-radius: 12px; background: var(--bg-soft); font-size: 0.95rem; color: #1E293B; transition: 0.2s; }
        .floating-input:focus { border-color: var(--primary-blue); background: #ffffff; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .floating-label { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.95rem; pointer-events: none; transition: 0.2s; font-weight: 500; }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; font-size: 0.7rem; color: var(--primary-blue); font-weight: 700; letter-spacing: 0.5px; }

        .btn-premium { background: linear-gradient(135deg, #001A33 0%, #000E1C 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 14px 28px; font-size: 0.95rem; letter-spacing: 0.5px; transition: 0.3s; display: inline-flex; align-items: center; justify-content: center; gap: 8px;}
        .btn-premium:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 26, 51, 0.3); color: white; }
        .btn-premium:disabled { opacity: 0.7; cursor: not-allowed; }
        
        .animate-fade { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="page-header d-flex flex-column flex-md-row justify-content-between align-items-md-center gap-3">
        <div>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Official Logbook</h2>
          <p className="text-muted mb-0 fw-medium">Record your technical tasks and track your internship hours.</p>
        </div>
        <button 
          className="btn-premium" 
          onClick={() => setShowModal(true)}
          disabled={!isInternshipActive}
        >
          <i className="bi bi-pencil-square fs-5"></i> 
          <span>Create New Entry</span>
        </button>
      </div>

      {/* --- NOTIFICATIONS & LOCKOUT WARNING --- */}
      {notification.message && (
        <div className={`alert alert-${notification.type === 'error' ? 'danger' : notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-info-circle-fill text-primary'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {!isInternshipActive && (
        <div className="alert alert-warning d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 p-4 animate-fade">
          <i className="bi bi-lock-fill fs-1 text-warning me-4"></i>
          <div>
            <h5 className="fw-bolder mb-1 text-dark">Logbook Locked</h5>
            <span className="fw-medium text-dark opacity-75 small">You cannot log hours until your placement has been officially accepted by a host company. Please check your Dashboard for status updates.</span>
          </div>
        </div>
      )}

      {/* --- METRICS DASHBOARD --- */}
      <div className="row g-4 mb-4 animate-fade">
        <div className="col-md-4">
          <div className="metric-card border-bottom border-4 border-primary">
            <div className="metric-icon bg-primary bg-opacity-10 text-primary"><i className="bi bi-stopwatch-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Total Hours</p>
              <h2 className="fw-bolder mb-0 text-dark">{totalHours} <span className="fs-6 text-muted fw-bold">hrs</span></h2>
            </div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="metric-card border-bottom border-4 border-success">
            <div className="metric-icon bg-success bg-opacity-10 text-success"><i className="bi bi-patch-check-fill"></i></div>
            <div className="w-100">
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Approved Weeks</p>
              <h2 className="fw-bolder mb-1 text-dark">{approvedCount} <span className="fs-6 text-muted fw-bold">/ 16</span></h2>
              <div className="progress rounded-pill bg-light" style={{ height: '6px' }}>
                <div className="progress-bar bg-success rounded-pill" style={{ width: `${(approvedCount / 16) * 100}%` }}></div>
              </div>
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="metric-card border-bottom border-4 border-warning">
            <div className="metric-icon bg-warning bg-opacity-10 text-warning"><i className="bi bi-hourglass-split"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Pending Review</p>
              <h2 className="fw-bolder mb-0 text-dark">{pendingCount} <span className="fs-6 text-muted fw-bold">logs</span></h2>
            </div>
          </div>
        </div>
      </div>

      {/* --- MAIN LOGBOOK TABLE --- */}
      <div className="premium-table table-responsive mb-5 animate-fade">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: '12%' }}>Week</th>
              <th style={{ width: '20%' }}>Duration</th>
              <th style={{ width: '45%' }}>Activity Summary</th>
              <th style={{ width: '10%' }}>Hours</th>
              <th className="text-end" style={{ width: '13%' }}>Status</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center py-5">
                  <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className="bi bi-journal-x text-muted opacity-50" style={{ fontSize: '2.5rem' }}></i>
                  </div>
                  <h5 className="text-dark fw-bold">No Entries Yet</h5>
                  <p className="text-muted small mb-0">Your logbook is currently empty. Start logging your weekly tasks.</p>
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id}>
                  <td>
                    <span className="badge bg-dark bg-opacity-10 text-dark px-3 py-2 rounded-pill border fw-bold shadow-sm">Week {log.weekNumber}</span>
                  </td>
                  <td>
                    <div className="d-flex flex-column gap-1 small fw-bold text-secondary">
                      <span className="text-dark"><i className="bi bi-calendar-event me-2 text-primary"></i>{new Date(log.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                      <span className="text-dark"><i className="bi bi-calendar-check me-2 text-danger"></i>{new Date(log.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric'})}</span>
                    </div>
                  </td>
                  <td>
                    <p className="mb-0 text-dark fw-medium" style={{ fontSize: '0.9rem', lineHeight: '1.6', display: '-webkit-box', WebkitLineClamp: '2', WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                      {log.description}
                    </p>
                  </td>
                  <td className="fw-bolder text-primary fs-5">{log.hours}<span className="text-muted small fw-bold ms-1">h</span></td>
                  <td className="text-end">
                    <span className={`status-pill ${
                      log.status === 'Approved' ? 'status-approved' : 
                      log.status === 'Rejected' ? 'status-rejected' : 'status-submitted'
                    }`}>
                      <i className={`bi ${
                        log.status === 'Approved' ? 'bi-check-circle-fill' : 
                        log.status === 'Rejected' ? 'bi-x-circle-fill' : 'bi-hourglass-split'
                      }`}></i> {log.status}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- ADD LOG ENTRY MODAL --- */}
      {showModal && (
        <div className="glass-overlay">
          <div className="glass-modal">
            
            <div className="p-4 border-bottom bg-light">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="fw-bolder text-dark mb-1">Add Weekly Log</h4>
                  <p className="text-muted small mb-0">Record your technical tasks and hours for the week.</p>
                </div>
                <button type="button" className="btn btn-white border shadow-sm rounded-circle" onClick={() => setShowModal(false)}>
                  <i className="bi bi-x-lg"></i>
                </button>
              </div>
            </div>

            <div className="p-4 p-md-5">
              <form onSubmit={handleSubmit}>
                <div className="row g-3">
                  <div className="col-md-4">
                    <div className="floating-group">
                      <input type="number" className="floating-input fw-bold text-dark" placeholder=" " min="1" max="16" value={newLog.weekNumber} onChange={(e) => setNewLog({...newLog, weekNumber: e.target.value})} required />
                      <label className="floating-label">Week No. (1-16)</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="floating-group">
                      <input type="date" className="floating-input fw-bold text-dark" style={{paddingTop: '1.6rem', paddingBottom: '0.4rem'}} value={newLog.startDate} onChange={(e) => setNewLog({...newLog, startDate: e.target.value})} required />
                      <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Start Date</label>
                    </div>
                  </div>
                  <div className="col-md-4">
                    <div className="floating-group">
                      <input type="date" className="floating-input fw-bold text-dark" style={{paddingTop: '1.6rem', paddingBottom: '0.4rem'}} value={newLog.endDate} onChange={(e) => setNewLog({...newLog, endDate: e.target.value})} required />
                      <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>End Date</label>
                    </div>
                  </div>
                </div>

                <div className="floating-group">
                  <textarea 
                    className="floating-input fw-medium text-dark" 
                    rows="5" 
                    placeholder=" " 
                    value={newLog.description} 
                    onChange={(e) => setNewLog({...newLog, description: e.target.value})} 
                    required 
                    style={{ resize: 'none', lineHeight: '1.6' }}
                  ></textarea>
                  <label className="floating-label">Detail the technical tasks completed, tools utilized, and specific skills gained this week...</label>
                </div>

                <div className="floating-group mb-5" style={{ maxWidth: '200px' }}>
                  <input type="number" className="floating-input text-primary fw-bolder fs-4" placeholder=" " min="1" max="60" value={newLog.hours} onChange={(e) => setNewLog({...newLog, hours: e.target.value})} required />
                  <label className="floating-label">Total Hours Logged</label>
                </div>

                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-light fw-bold w-50 py-3 rounded-3" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-premium bg-success w-50 py-3 rounded-3" disabled={submitting} style={{ background: 'linear-gradient(135deg, #10B981 0%, #059669 100%)' }}>
                    {submitting ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-cloud-arrow-up-fill me-2"></i> Submit Log Entry</>}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      )}

    </Layout>
  );
};

export default StudentLogbook;