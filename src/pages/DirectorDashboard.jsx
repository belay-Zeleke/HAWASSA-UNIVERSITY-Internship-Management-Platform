import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase-config';
import { collection, onSnapshot, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const DirectorDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [deptFilter, setDeptFilter] = useState("All");
  const [activeTab, setActiveTab] = useState("ActionCenter"); 
  const [notification, setNotification] = useState({ type: '', message: '' });
  
  // NEW: State to control our beautiful custom confirmation modal
  const [confirmApp, setConfirmApp] = useState(null);

  const role = localStorage.getItem('role') || 'DeputyDirector';
  const userName = localStorage.getItem('userName') || 'Executive Admin';

  const STIPEND_AMOUNT = 1500; 

  useEffect(() => {
    const q = query(collection(db, "applications"));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      apps.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setApplications(apps);
      setLoading(false);
    }, (error) => {
      console.error("Master Sync Error:", error);
      setNotification({ type: 'danger', message: 'Failed to sync with the central database.'});
      setLoading(false);
    });
    return () => unsubscribe();
  }, []);

  // UPDATED: No more window.confirm(). This just executes the actual approval.
  const executeAcademicApproval = async () => {
    if (!confirmApp) return;

    setProcessingId(confirmApp.id);
    setNotification({ type: '', message: '' });

    try {
      const appRef = doc(db, "applications", confirmApp.id);
      const approvalId = `ACAD-${Math.floor(100000 + Math.random() * 900000)}`;
      
      await updateDoc(appRef, { 
        status: 'AcademicallyApproved', 
        directorName: userName,
        academicApprovalId: approvalId,
        approvalType: 'Academic Clearance Verification',
        directorApprovedAt: serverTimestamp()
      });

      setNotification({ type: 'success', message: `Academic Approval granted for ${confirmApp.studentName}. File forwarded to Finance Office. (Ref: ${approvalId})` });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Approval failed: ${err.message}` });
    } finally {
      setProcessingId(null);
      setConfirmApp(null); // Close the modal
    }
  };

  const analytics = useMemo(() => {
    const total = applications.length;
    const pendingDeliverables = applications.filter(a => ['Registered', 'Assigned', 'Active', 'CompanyEvaluated', 'ReportSubmitted'].includes(a.status)).length;
    const awaitingDirector = applications.filter(a => a.status === 'PendingAcademicApproval').length;
    const awaitingFinance = applications.filter(a => a.status === 'AcademicallyApproved').length; 
    const fullyCleared = applications.filter(a => a.status === 'FinanceProcessed').length;

    const clearanceRate = total > 0 ? Math.round((fullyCleared / total) * 100) : 0;
    const budgetCommitted = fullyCleared * STIPEND_AMOUNT;

    const deptStats = {};
    applications.forEach(app => {
      const d = app.department || 'Unspecified';
      if (!deptStats[d]) deptStats[d] = { total: 0, placed: 0 };
      deptStats[d].total += 1;
      if (app.status === 'FinanceProcessed') deptStats[d].placed += 1;
    });

    return { total, pendingDeliverables, awaitingDirector, awaitingFinance, fullyCleared, clearanceRate, budgetCommitted, deptStats };
  }, [applications]);

  const filteredApps = useMemo(() => {
    let baseApps = applications;
    
    if (activeTab === 'ActionCenter') {
      baseApps = applications.filter(app => app.status === 'PendingAcademicApproval');
    }

    return baseApps.filter(app => {
      const matchesDept = deptFilter === 'All' || app.department === deptFilter;
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (app.studentName?.toLowerCase() || '').includes(searchLower) ||
        (app.studentId?.toLowerCase() || '').includes(searchLower) ||
        (app.companyName?.toLowerCase() || '').includes(searchLower);
      
      return matchesDept && matchesSearch;
    });
  }, [applications, deptFilter, searchTerm, activeTab]);

  const getStatusBadge = (status) => {
    switch(status) {
      case 'FinanceProcessed': return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill"><i className="bi bi-check-circle-fill me-1"></i> Officially Cleared</span>;
      case 'AcademicallyApproved': return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 rounded-pill"><i className="bi bi-bank me-1"></i> Awaiting Finance</span>;
      case 'PendingAcademicApproval': return <span className="badge bg-warning bg-opacity-10 text-warning border border-warning border-opacity-25 px-3 py-2 rounded-pill text-dark"><i className="bi bi-hourglass-split me-1"></i> Awaiting Director</span>;
      case 'Rejected': 
      case 'RejectedByCompany': return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-2 rounded-pill"><i className="bi bi-x-circle-fill me-1"></i> Placement Failed</span>;
      default: return <span className="badge bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25 px-3 py-2 rounded-pill"><i className="bi bi-file-earmark-text me-1"></i> Pipeline Active</span>;
    }
  };

  return (
    <Layout role={role} userName={userName}>
      <style>{`
        :root { --primary-dark: #001A33; --accent-gold: #FFCC00; --bg-soft: #F8FAFC; }
        .exec-header { margin-bottom: 2.5rem; }
        .controls-bar { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 12px 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 1rem; }
        .nav-pills-custom .nav-link { color: #64748B; font-weight: 800; border-radius: 10px; padding: 10px 24px; transition: all 0.3s ease; cursor: pointer; border: none; background: transparent; letter-spacing: 0.5px; }
        .nav-pills-custom .nav-link.active { background-color: var(--primary-dark); color: #ffffff; box-shadow: 0 4px 15px rgba(0, 26, 51, 0.2); }
        .kpi-card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 20px; padding: 2rem; position: relative; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.4s ease; }
        .kpi-card:hover { transform: translateY(-5px); box-shadow: 0 20px 40px rgba(0,0,0,0.08); border-color: #CBD5E1; }
        .kpi-icon-bg { position: absolute; right: -20px; bottom: -20px; font-size: 8rem; opacity: 0.03; transform: rotate(-15deg); pointer-events: none; }
        .funnel-container { background: var(--bg-soft); border: 1px solid #E2E8F0; border-radius: 20px; padding: 2rem; display: flex; justify-content: space-between; align-items: center; margin-bottom: 2.5rem; box-shadow: inset 0 2px 4px rgba(0,0,0,0.02); overflow-x: auto; }
        .funnel-step { text-align: center; flex: 1; position: relative; min-width: 120px; }
        .funnel-step:not(:last-child)::after { content: '\\F138'; font-family: 'bootstrap-icons'; position: absolute; right: -10px; top: 25%; color: #CBD5E1; font-size: 1.5rem; transform: translateY(-50%); }
        .step-number { font-size: 2.2rem; font-weight: 900; color: var(--primary-dark); line-height: 1; margin-bottom: 5px; }
        .step-label { font-size: 0.75rem; font-weight: 800; text-transform: uppercase; color: #64748B; letter-spacing: 0.5px; }
        .dept-card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1.5rem; transition: 0.3s; }
        .dept-card:hover { border-color: #0055FF; box-shadow: 0 10px 20px rgba(0, 85, 255, 0.05); }
        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1.2rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
        .premium-table tbody tr:hover { background: var(--bg-soft); }
        .search-input { width: 100%; padding: 10px 16px 10px 42px; border-radius: 10px; border: 1px solid #E2E8F0; background: var(--bg-soft); font-size: 0.95rem; transition: 0.3s; }
        .search-input:focus { background: #ffffff; border-color: #0055FF; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .btn-export { background: var(--primary-dark); color: white; font-weight: 800; border: none; border-radius: 10px; padding: 12px 24px; transition: all 0.3s ease; display: inline-flex; align-items: center; gap: 8px; }
        .btn-export:hover { background: #000E1C; transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 26, 51, 0.3); color: white; }
        .btn-approve-final { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; font-weight: 800; border: none; border-radius: 10px; padding: 10px 20px; transition: 0.3s; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
        .btn-approve-final:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(16, 185, 129, 0.4); }
        .btn-approve-final:disabled { opacity: 0.7; cursor: not-allowed; }
        .animate-fade { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        
        /* NEW: Modal CSS */
        .glass-overlay { position: fixed; inset: 0; background: rgba(0, 14, 28, 0.7); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; opacity: 0; animation: fadeIn 0.3s forwards; }
        .glass-modal { background: #ffffff; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.4); width: 100%; max-width: 500px; overflow: hidden; animation: slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255,255,255,0.8); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .btn-cancel { background: #F1F5F9; color: #64748B; font-weight: 800; border: none; border-radius: 12px; padding: 14px 24px; transition: 0.2s; width: 100%; }
        .btn-cancel:hover { background: #E2E8F0; color: #1E293B; }
        .btn-confirm-modal { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 14px 24px; transition: 0.3s; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2); width: 100%; }
        .btn-confirm-modal:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
      `}</style>

      <div className="exec-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 no-print">
        <div>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-1px', fontSize: '2.2rem' }}>Academic Command</h2>
          <p className="text-muted mb-0 fw-medium fs-5">University-wide academic oversight and authorizations.</p>
        </div>
        <button className="btn-export" onClick={() => window.print()}>
          <i className="bi bi-file-earmark-pdf-fill"></i> Generate Master Report
        </button>
      </div>

      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="kpi-card" style={{ borderTop: '4px solid #0055FF' }}>
            <i className="bi bi-people-fill kpi-icon-bg text-primary"></i>
            <h6 className="text-muted fw-bold text-uppercase mb-2" style={{ letterSpacing: '1px' }}>Active Cohort</h6>
            <h1 className="display-4 fw-bolder text-dark mb-0">{analytics.total}</h1>
            <p className="text-primary small fw-bold mt-2 mb-0"><i className="bi bi-graph-up-arrow me-1"></i> Total Registered Students</p>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="kpi-card" style={{ borderTop: '4px solid #10B981' }}>
            <i className="bi bi-patch-check-fill kpi-icon-bg text-success"></i>
            <h6 className="text-muted fw-bold text-uppercase mb-2" style={{ letterSpacing: '1px' }}>Institutional Clearance</h6>
            <h1 className="display-4 fw-bolder text-dark mb-0">{analytics.clearanceRate}<span className="fs-3 text-muted">%</span></h1>
            <p className="text-success small fw-bold mt-2 mb-0"><i className="bi bi-check-all me-1"></i> Students completely finalized</p>
          </div>
        </div>

        <div className="col-md-4">
          <div className="kpi-card" style={{ borderTop: '4px solid #F59E0B' }}>
            <i className="bi bi-bank2 kpi-icon-bg text-warning"></i>
            <h6 className="text-muted fw-bold text-uppercase mb-2" style={{ letterSpacing: '1px' }}>Total Funds Cleared</h6>
            <h1 className="display-4 fw-bolder text-dark mb-0 font-monospace" style={{ letterSpacing: '-2px' }}>
              {analytics.budgetCommitted.toLocaleString()}
            </h1>
            <p className="text-warning small fw-bold mt-2 mb-0 text-dark"><i className="bi bi-cash-coin me-1"></i> Total ETB Officially Processed</p>
          </div>
        </div>
      </div>

      <div className="controls-bar no-print">
        <div className="d-flex nav-pills-custom gap-2">
          <button className={`nav-link ${activeTab === 'ActionCenter' ? 'active' : ''}`} onClick={() => setActiveTab('ActionCenter')}>
            <i className="bi bi-shield-lock-fill me-2"></i> Approval Queue 
            {analytics.awaitingDirector > 0 && <span className="badge bg-danger rounded-pill ms-2">{analytics.awaitingDirector}</span>}
          </button>
          <button className={`nav-link ${activeTab === 'MasterRegistry' ? 'active' : ''}`} onClick={() => setActiveTab('MasterRegistry')}>
            <i className="bi bi-database-fill me-2"></i> Master Registry & Analytics
          </button>
        </div>
        
        <div className="d-flex gap-2">
          <select className="form-select border-light shadow-sm fw-bold text-muted" style={{ width: '180px', borderRadius: '10px' }} value={deptFilter} onChange={(e) => setDeptFilter(e.target.value)}>
            <option value="All">All Departments</option>
            <option value="Information Systems">Information Systems</option>
            <option value="Information Technology">Information Technology</option>
            <option value="Computer Science">Computer Science</option>
          </select>
          <div className="position-relative" style={{ width: '250px' }}>
            <i className="bi bi-search position-absolute text-muted" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)' }}></i>
            <input type="text" className="search-input" placeholder="Search registry..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        </div>
      </div>

      {activeTab === 'MasterRegistry' && (
        <div className="animate-fade">
          
          <div className="funnel-container">
            <div className="funnel-step">
              <div className="step-number">{analytics.pendingDeliverables}</div>
              <div className="step-label">In Progress</div>
            </div>
            <div className="funnel-step">
              <div className="step-number text-warning">{analytics.awaitingDirector}</div>
              <div className="step-label">Awaiting Academic</div>
            </div>
            <div className="funnel-step">
              <div className="step-number text-primary">{analytics.awaitingFinance}</div>
              <div className="step-label">Awaiting Finance</div>
            </div>
            <div className="funnel-step">
              <div className="step-number text-success">{analytics.fullyCleared}</div>
              <div className="step-label">Fully Cleared</div>
            </div>
          </div>

          <h5 className="fw-bolder mb-3 text-dark">Departmental Readiness Matrix</h5>
          <div className="row g-4 mb-5">
            {['Information Systems', 'Information Technology', 'Computer Science'].map(dept => {
              const stats = analytics.deptStats[dept] || { total: 0, placed: 0 };
              const rate = stats.total > 0 ? Math.round((stats.placed / stats.total) * 100) : 0;
              return (
                <div className="col-md-4" key={dept}>
                  <div className="dept-card shadow-sm h-100">
                    <div className="d-flex justify-content-between align-items-center mb-3">
                      <span className="fw-bold text-dark">{dept}</span>
                      <span className={`badge ${rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning text-dark' : 'bg-danger'} fs-6`}>
                        {rate}%
                      </span>
                    </div>
                    <div className="progress rounded-pill bg-light mb-3" style={{ height: '8px' }}>
                      <div className={`progress-bar rounded-pill ${rate >= 80 ? 'bg-success' : rate >= 50 ? 'bg-warning' : 'bg-danger'}`} style={{ width: `${rate}%` }}></div>
                    </div>
                    <div className="d-flex justify-content-between small text-muted fw-bolder text-uppercase" style={{ letterSpacing: '0.5px' }}>
                      <span>{stats.placed} Finalized</span>
                      <span>{stats.total} Active</span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      <div className="premium-table table-responsive mb-5 animate-fade">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Student Identity</th>
              <th style={{ width: '20%' }}>Academic Unit</th>
              <th style={{ width: '25%' }}>Deliverables</th>
              <th className="text-end" style={{ width: '30%' }}>{activeTab === 'ActionCenter' ? 'Executive Action' : 'Pipeline Status'}</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
            ) : filteredApps.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-5 text-muted">
                  <i className={`bi ${activeTab === 'ActionCenter' ? 'bi-shield-check text-success' : 'bi-folder-x'} fs-1 opacity-50 mb-3 d-block`}></i>
                  <h5 className="fw-bolder text-dark">{activeTab === 'ActionCenter' ? 'Clearance Queue Empty' : 'No Records Found'}</h5>
                  <p className="small mb-0">{activeTab === 'ActionCenter' ? 'No students are currently awaiting academic approval.' : 'Try adjusting your search filters.'}</p>
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div className="fw-bolder text-dark">{app.studentName}</div>
                    <div className="small text-muted font-monospace mt-1">ID: {app.studentId || 'N/A'}</div>
                  </td>
                  <td><span className="badge bg-light text-dark border px-3 py-2 rounded-pill fw-bold">{app.department || 'Informatics'}</span></td>
                  <td>
                    <div className="small mt-1"><span className="fw-bold text-dark">Corp Score:</span> <span className="text-success fw-bolder">{app.companyScore || 0}/100</span></div>
                  </td>
                  <td className="text-end">
                    
                    {activeTab === 'ActionCenter' ? (
                      <button 
                        className="btn-approve-final"
                        // Trigger the modal instead of the window.confirm directly
                        onClick={() => setConfirmApp(app)}
                        disabled={processingId === app.id}
                      >
                        {processingId === app.id ? (
                          <><span className="spinner-border spinner-border-sm me-2"></span> Processing...</>
                        ) : (
                          <><i className="bi bi-check-all fs-5 me-1"></i> Authorize Clearance</>
                        )}
                      </button>
                    ) : (
                      <div className="d-flex flex-column align-items-end">
                        {getStatusBadge(app.status)}
                        {app.academicApprovalId && (
                          <div className="small text-muted mt-2 font-monospace" style={{ fontSize: '0.65rem' }}>
                            Ref: <strong>{app.academicApprovalId}</strong>
                          </div>
                        )}
                      </div>
                    )}

                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* --- NEW BEAUTIFUL CONFIRMATION MODAL --- */}
      {confirmApp && createPortal(
        <div className="glass-overlay" onClick={() => setConfirmApp(null)}>
           <div className="glass-modal" onClick={e => e.stopPropagation()}>
             
             {/* Header */}
             <div className="p-4 border-bottom text-center bg-light">
                <div className="rounded-circle d-inline-flex align-items-center justify-content-center bg-success bg-opacity-10 text-success mb-3" style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                  <i className="bi bi-shield-check"></i>
                </div>
                <h4 className="fw-bolder text-dark m-0">Confirm Academic Clearance</h4>
             </div>
             
             {/* Body */}
             <div className="p-4 p-md-5 bg-white text-center">
               <p className="text-muted fw-medium fs-5 mb-4">
                 You are about to officially verify the deliverables for 
                 <strong className="text-dark d-block fs-3 mt-2">{confirmApp.studentName}</strong>
               </p>
               <div className="p-3 bg-primary bg-opacity-10 border border-primary border-opacity-25 rounded-3 mb-4">
                  <p className="small text-primary fw-bold mb-0">
                    <i className="bi bi-info-circle-fill me-2"></i>
                    This action will authorize the Finance Office to release their stipend fund.
                  </p>
               </div>
               
               <div className="row g-3">
                 <div className="col-6">
                   <button className="btn-cancel" onClick={() => setConfirmApp(null)}>
                     Cancel
                   </button>
                 </div>
                 <div className="col-6">
                   <button className="btn-confirm-modal d-flex align-items-center justify-content-center gap-2" onClick={executeAcademicApproval}>
                     <i className="bi bi-check-all fs-5"></i> Confirm
                   </button>
                 </div>
               </div>
             </div>

           </div>
        </div>
      , document.body)}

    </Layout>
  );
};

export default DirectorDashboard;