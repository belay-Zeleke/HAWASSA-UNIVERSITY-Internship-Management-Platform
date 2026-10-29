import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase-config';
import { collection, onSnapshot, query, where, doc, updateDoc, getDocs, serverTimestamp } from 'firebase/firestore';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const DepartmentDashboard = () => {
  const [students, setStudents] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [logbooks, setLogbooks] = useState([]); 
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Assign"); 
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [selectedCompany, setSelectedCompany] = useState({}); 
  
  // NEW: Unified State for the Custom Action Modal
  const [confirmModal, setConfirmModal] = useState({ show: false, config: null });

  const role = localStorage.getItem('role') || 'DepartmentStaff';
  const userName = localStorage.getItem('userName') || 'Dept Admin';
  const staffDept = localStorage.getItem('department') || 'Information Systems'; 

  useEffect(() => {
    if (!staffDept) return;

    // 1. Fetch Students in this Department
    const qStudents = query(
      collection(db, "applications"),
      where("department", "==", staffDept)
    );

    const unsubStudents = onSnapshot(qStudents, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      studentData.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setStudents(studentData);
      setLoading(false);
    }, (error) => {
      console.error("Dept Sync Error:", error);
      setNotification({ type: 'danger', message: 'Failed to securely connect to the university registry.' });
      setLoading(false);
    });

    // 2. Fetch Companies
    const fetchCompanies = async () => {
      try {
        const qComps = query(collection(db, "users"), where("role", "==", "CompanyRepresentative"));
        const compSnapshot = await getDocs(qComps);
        setCompanies(compSnapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error("Failed to load company registry", err);
      }
    };

    // 3. Fetch Pending Logbooks
    const qLogs = query(collection(db, "logbooks"), where("status", "==", "Submitted"));
    const unsubLogs = onSnapshot(qLogs, (snapshot) => {
      const logsData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setLogbooks(logsData);
    });

    fetchCompanies();
    return () => { unsubStudents(); unsubLogs(); };
  }, [staffDept]);

  // --- MODAL PROMPT TRIGGERS ---
  
  const promptSelfPlacement = (app) => {
    setConfirmModal({
      show: true,
      config: {
        type: 'SELF_PLACEMENT',
        title: 'Verify Self-Placement',
        message: `Approve ${app.studentName}'s self-placement at ${app.companyName}? This will forward the request to the company for final acceptance.`,
        icon: 'bi-building-check',
        colorClass: 'text-primary',
        bgClass: 'bg-primary',
        actionData: app
      }
    });
  };

  const promptVerifyReport = (app) => {
    setConfirmModal({
      show: true,
      config: {
        type: 'VERIFY_REPORT',
        title: 'Verify Final Deliverables',
        message: `Mark ${app.studentName}'s internship deliverables as reviewed and forward to the Deputy Director for final clearance?`,
        icon: 'bi-check2-all',
        colorClass: 'text-success',
        bgClass: 'bg-success',
        actionData: app
      }
    });
  };

  const promptLogAction = (log, action) => {
    const isApprove = action === 'Approved';
    setConfirmModal({
      show: true,
      config: {
        type: 'LOG_ACTION',
        title: isApprove ? 'Approve Weekly Log' : 'Reject Weekly Log',
        message: `Are you sure you want to ${action.toLowerCase()} Week ${log.weekNumber} for ${log.studentName}?`,
        icon: isApprove ? 'bi-journal-check' : 'bi-journal-x',
        colorClass: isApprove ? 'text-success' : 'text-danger',
        bgClass: isApprove ? 'bg-success' : 'bg-danger',
        actionData: { logId: log.id, action, studentName: log.studentName }
      }
    });
  };

  // --- EXECUTORS (Called by the Modal) ---
  
  const executeModalAction = async () => {
    const { type, actionData } = confirmModal.config;
    setConfirmModal({ show: false, config: null }); // Close modal instantly

    if (type === 'SELF_PLACEMENT') {
      await processSelfPlacement(actionData);
    } else if (type === 'VERIFY_REPORT') {
      await processVerifyReport(actionData);
    } else if (type === 'LOG_ACTION') {
      await processLogAction(actionData.logId, actionData.action, actionData.studentName);
    }
  };

  const handleAssignCompany = async (applicationId, studentName) => {
    const companyId = selectedCompany[applicationId];
    if (!companyId) {
      setNotification({ type: 'warning', message: 'Please select a partner company from the dropdown menu first.' });
      return;
    }
    const companyData = companies.find(c => c.id === companyId);
    setProcessingId(applicationId);
    setNotification({ type: '', message: '' });

    try {
      const appRef = doc(db, "applications", applicationId);
      await updateDoc(appRef, { 
        status: 'Assigned', 
        companyId: companyData.id,
        companyName: companyData.companyName,
        assignedBy: userName,
        assignedAt: serverTimestamp()
      });
      setNotification({ type: 'success', message: `${studentName} assigned to ${companyData.companyName}. Awaiting company acceptance.` });
      const newSelectState = {...selectedCompany};
      delete newSelectState[applicationId];
      setSelectedCompany(newSelectState);
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Assignment failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  const processSelfPlacement = async (app) => {
    setProcessingId(app.id);
    setNotification({ type: '', message: '' });
    try {
      const appRef = doc(db, "applications", app.id);
      await updateDoc(appRef, { 
        status: 'Assigned', 
        selfPlacementVerifiedBy: userName,
        selfPlacementVerifiedAt: serverTimestamp()
      });
      setNotification({ type: 'success', message: `${app.studentName}'s request forwarded to ${app.companyName} for acceptance.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Verification failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  const processVerifyReport = async (app) => {
    setProcessingId(app.id);
    setNotification({ type: '', message: '' });
    try {
      const appRef = doc(db, "applications", app.id);
      await updateDoc(appRef, { 
        status: 'PendingAcademicApproval', 
        deptReportApprovedBy: userName,
        deptReportApprovedAt: serverTimestamp()
      });
      setNotification({ type: 'success', message: `${app.studentName}'s report verified and forwarded for Executive Clearance.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Verification failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  const processLogAction = async (logId, action, studentName) => {
    setProcessingId(logId);
    setNotification({ type: '', message: '' });
    try {
      const logRef = doc(db, "logbooks", logId);
      await updateDoc(logRef, { 
        status: action, 
        reviewedBy: userName,
        reviewedAt: serverTimestamp()
      });
      setNotification({ type: 'success', message: `Log entry safely ${action.toLowerCase()}.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Failed to update log: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // --- FILTERING & ANALYTICS ---

  const departmentStudentIds = useMemo(() => students.map(s => s.userId), [students]);
  const departmentLogs = useMemo(() => {
    return logbooks.filter(log => departmentStudentIds.includes(log.studentId));
  }, [logbooks, departmentStudentIds]);

  const stats = useMemo(() => {
    return {
      assignQueue: students.filter(s => s.status === 'PendingDeptApproval' && s.placementType !== 'self').length,
      selfPlacements: students.filter(s => s.status === 'PendingDeptApproval' && s.placementType === 'self').length,
      active: students.filter(s => s.status === 'Active').length,
      pendingReviews: students.filter(s => ['CompanyEvaluated', 'ReportSubmitted'].includes(s.status)).length,
      pendingLogs: departmentLogs.length 
    };
  }, [students, departmentLogs]);

  const filteredData = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    if (activeTab === 'WeeklyLogs') {
      return departmentLogs.filter(log => 
        (log.studentName?.toLowerCase() || '').includes(searchLower) ||
        (log.description?.toLowerCase() || '').includes(searchLower)
      );
    }
    return students.filter(app => {
      let statusMatch = false;
      if (activeTab === 'Assign') statusMatch = app.status === 'PendingDeptApproval' && app.placementType !== 'self';
      if (activeTab === 'SelfPlacement') statusMatch = app.status === 'PendingDeptApproval' && app.placementType === 'self';
      if (activeTab === 'Active') statusMatch = app.status === 'Active';
      if (activeTab === 'Review') statusMatch = ['CompanyEvaluated', 'ReportSubmitted'].includes(app.status);

      const textMatch = (app.studentName?.toLowerCase() || '').includes(searchLower) || 
                        (app.studentId?.toLowerCase() || '').includes(searchLower) ||
                        (app.companyName?.toLowerCase() || '').includes(searchLower);
      
      return statusMatch && textMatch;
    });
  }, [students, departmentLogs, activeTab, searchTerm]);

  // ==========================================
  // NATIVE FETCH PDF VIEWER (Bypasses Chrome Data URI Block)
  // ==========================================
  const handleViewPdf = async (url) => {
    if (!url) { alert("No document found."); return; }
    try {
      if (url.startsWith('data:application/pdf') || url.startsWith('data:application/PDF')) {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
        setTimeout(() => URL.revokeObjectURL(blobUrl), 10000);
        return;
      }
      let finalUrl = url;
      if (!finalUrl.startsWith('http')) finalUrl = `https://${finalUrl}`;
      window.open(finalUrl, '_blank');
    } catch (err) { 
      alert("Failed to load PDF."); 
      console.error(err);
    }
  };

  return (
    <Layout role={role} userName={userName}>
      
      <style>{`
        :root { --primary-dept: #0055FF; --bg-soft: #F8FAFC; }
        .dept-header { margin-bottom: 2rem; border-left: 4px solid var(--primary-dept); padding-left: 1.5rem; }
        
        .stat-card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1.2rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .stat-icon { width: 50px; height: 50px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.4rem; }

        .controls-bar { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 12px 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 1rem; }
        .nav-pills-custom .nav-link { color: #64748B; font-weight: 700; border-radius: 10px; padding: 10px 16px; transition: all 0.2s ease; cursor: pointer; border: none; background: transparent; font-size: 0.9rem;}
        .nav-pills-custom .nav-link.active { background-color: #001A33; color: #ffffff; box-shadow: 0 4px 10px rgba(0, 26, 51, 0.2); }

        .search-input-wrapper { position: relative; width: 280px; }
        .search-input-wrapper i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94A3B8; }
        .search-input { width: 100%; padding: 10px 16px 10px 42px; border-radius: 12px; border: 1px solid #E2E8F0; background: var(--bg-soft); font-size: 0.9rem; transition: 0.3s; }
        .search-input:focus { background: #ffffff; border-color: var(--primary-dept); box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        
        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; transition: 0.2s; }
        .premium-table tbody tr:hover td { background: var(--bg-soft); }

        .btn-action { font-weight: 700; border: none; border-radius: 10px; padding: 8px 20px; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px; font-size: 0.9rem;}
        .btn-assign { background: var(--primary-dept); color: white; }
        .btn-assign:hover:not(:disabled) { background: #0044CC; transform: translateY(-2px); box-shadow: 0 6px 15px rgba(0, 85, 255, 0.3); }
        .btn-approve { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; }
        .btn-approve:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3); }
        .btn-reject { background: #F8FAFC; color: #EF4444; border: 1px solid #FECACA; }
        .btn-reject:hover:not(:disabled) { background: #FEF2F2; transform: translateY(-2px); }
        .btn-action:disabled { opacity: 0.7; cursor: not-allowed; }

        .avatar-initial { width: 42px; height: 42px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; border: 1px solid #BFDBFE; flex-shrink: 0; }
        
        .animate-fade { animation: slideUpFade 0.4s ease forwards; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* MODAL STYLES */
        .glass-overlay { position: fixed; inset: 0; background: rgba(0, 14, 28, 0.7); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; opacity: 0; animation: fadeIn 0.3s forwards; }
        .glass-modal { background: #ffffff; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.4); width: 100%; max-width: 500px; overflow: hidden; animation: slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255,255,255,0.8); }
        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes slideUpModal { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .btn-cancel { background: #F1F5F9; color: #64748B; font-weight: 800; border: none; border-radius: 12px; padding: 14px 24px; transition: 0.2s; width: 100%; }
        .btn-cancel:hover { background: #E2E8F0; color: #1E293B; }
        .btn-confirm-modal { background: linear-gradient(135deg, #0055FF 0%, #0044CC 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 14px 24px; transition: 0.3s; box-shadow: 0 4px 15px rgba(0, 85, 255, 0.2); width: 100%; }
        .btn-confirm-modal:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(0, 85, 255, 0.4); }
        .btn-confirm-modal.danger { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2); }
        .btn-confirm-modal.danger:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4); }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="dept-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 no-print">
        <div>
          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-3 py-2 rounded-pill fw-bolder text-uppercase mb-2" style={{ letterSpacing: '1px' }}>
            {staffDept} Department
          </span>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Placement Configuration Office</h2>
          <p className="text-muted mb-0 fw-medium">Manage assignments, weekly logs, and final deliverables.</p>
        </div>
        <button className="btn btn-white border fw-bold shadow-sm rounded-3 px-4 py-2 text-dark d-flex align-items-center gap-2" onClick={() => window.print()}>
          <i className="bi bi-file-earmark-spreadsheet-fill text-primary"></i> Export List
        </button>
      </div>

      {/* --- NOTIFICATIONS --- */}
      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-warning'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {/* --- DEPARTMENT METRICS --- */}
      <div className="row g-3 mb-4">
        <div className="col-lg col-md-4 col-sm-6">
          <div className="stat-card">
            <div className="stat-icon bg-primary bg-opacity-10 text-primary"><i className="bi bi-building-add"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Assign Queue</p>
              <h3 className="fw-bolder mb-0 text-dark">{stats.assignQueue}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg col-md-4 col-sm-6">
          <div className="stat-card">
            <div className="stat-icon bg-info bg-opacity-10 text-info"><i className="bi bi-person-check-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Self-Placements</p>
              <h3 className="fw-bolder mb-0 text-dark">{stats.selfPlacements}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg col-md-4 col-sm-6">
          <div className="stat-card">
            <div className="stat-icon bg-success bg-opacity-10 text-success"><i className="bi bi-briefcase-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Active Interns</p>
              <h3 className="fw-bolder mb-0 text-dark">{stats.active}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg col-md-6 col-sm-6">
          <div className="stat-card" style={{ borderColor: stats.pendingLogs > 0 ? '#FDE68A' : '#E2E8F0', background: stats.pendingLogs > 0 ? '#FFFBEB' : '#ffffff' }}>
            <div className="stat-icon bg-warning bg-opacity-25 text-warning"><i className="bi bi-journal-text"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Weekly Logs</p>
              <h3 className="fw-bolder mb-0 text-dark">{stats.pendingLogs}</h3>
            </div>
          </div>
        </div>
        <div className="col-lg col-md-6 col-sm-12">
          <div className="stat-card">
            <div className="stat-icon bg-secondary bg-opacity-10 text-secondary"><i className="bi bi-file-earmark-check-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase mb-0" style={{ fontSize: '0.7rem', letterSpacing: '0.5px' }}>Final Reviews</p>
              <h3 className="fw-bolder mb-0 text-dark">{stats.pendingReviews}</h3>
            </div>
          </div>
        </div>
      </div>

      {/* --- CONTROLS BAR --- */}
      <div className="controls-bar no-print">
        <div className="d-flex nav-pills-custom gap-2 overflow-auto pb-2 pb-md-0">
          <button className={`nav-link text-nowrap ${activeTab === 'Assign' ? 'active' : ''}`} onClick={() => setActiveTab('Assign')}>
            Assigned Queue {stats.assignQueue > 0 && <span className="badge bg-danger rounded-pill ms-1">{stats.assignQueue}</span>}
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'SelfPlacement' ? 'active' : ''}`} onClick={() => setActiveTab('SelfPlacement')}>
            Self-Placements {stats.selfPlacements > 0 && <span className="badge bg-info text-dark rounded-pill ms-1">{stats.selfPlacements}</span>}
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'Active' ? 'active' : ''}`} onClick={() => setActiveTab('Active')}>
            Monitor Active {stats.active > 0 && <span className="badge bg-primary rounded-pill ms-1">{stats.active}</span>}
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'WeeklyLogs' ? 'active' : ''}`} onClick={() => setActiveTab('WeeklyLogs')}>
            Weekly Logs {stats.pendingLogs > 0 && <span className="badge bg-warning text-dark rounded-pill ms-1">{stats.pendingLogs}</span>}
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'Review' ? 'active' : ''}`} onClick={() => setActiveTab('Review')}>
            Final Reports {stats.pendingReviews > 0 && <span className="badge bg-secondary rounded-pill ms-1">{stats.pendingReviews}</span>}
          </button>
        </div>
        <div className="search-input-wrapper mt-2 mt-md-0">
          <i className="bi bi-search"></i>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search database..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* --- DATA GRIDS --- */}
      <div className="premium-table table-responsive mb-5 animate-fade">
        <table className="table align-middle mb-0">
          
          {/* TAB 1: UNIVERSITY ASSIGNED */}
          {activeTab === 'Assign' && (
            <>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Student Info</th>
                  <th style={{ width: '25%' }}>Placement Details</th>
                  <th style={{ width: '25%' }}>Select Partner Organization</th>
                  <th className="text-end" style={{ width: '20%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5 text-muted">
                      <i className="bi bi-building-up fs-1 d-block mb-3 opacity-50"></i>
                      <h6 className="fw-bold text-dark">No Pending Assignments</h6>
                      <p className="small mb-0">All university-path students have been processed.</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="avatar-initial shadow-sm">{app.studentName?.charAt(0).toUpperCase() || 'S'}</div>
                          <div>
                            <div className="fw-bolder text-dark">{app.studentName}</div>
                            <div className="small text-muted font-monospace mt-1">ID: {app.studentId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="mb-2">
                          <span className="badge bg-info text-dark bg-opacity-10 border px-3 py-1 rounded-pill">University Assigned</span>
                        </div>
                        <div className="small text-muted fw-medium mt-1">
                          <i className="bi bi-diagram-3 me-1 text-primary"></i> {app.requestedWorkingArea || 'General'}
                        </div>
                      </td>
                      <td>
                        <div className="position-relative">
                          <select 
                            className="form-select fw-bold border-light shadow-sm text-primary" 
                            style={{ backgroundColor: '#F8FAFC', borderRadius: '10px', padding: '10px 16px', cursor: 'pointer' }}
                            onChange={(e) => setSelectedCompany({...selectedCompany, [app.id]: e.target.value})}
                            value={selectedCompany[app.id] || ''}
                          >
                            <option value="" disabled>Browse Active Partners...</option>
                            {companies.map(c => <option key={c.id} value={c.id}>{c.companyName} ({c.location || 'N/A'})</option>)}
                          </select>
                        </div>
                      </td>
                      <td className="text-end">
                        <button className="btn-action btn-assign w-100" onClick={() => handleAssignCompany(app.id, app.studentName)} disabled={processingId === app.id}>
                          {processingId === app.id ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-send-plus-fill"></i> Assign</>}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}

          {/* TAB 2: SELF-PLACEMENT VERIFICATION */}
          {activeTab === 'SelfPlacement' && (
            <>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Student Info</th>
                  <th style={{ width: '25%' }}>Placement Details</th>
                  <th style={{ width: '25%' }}>Proposed Organization Data</th>
                  <th className="text-end" style={{ width: '20%' }}>Verification</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5 text-muted">
                      <i className="bi bi-person-bounding-box fs-1 d-block mb-3 opacity-50"></i>
                      <h6 className="fw-bold text-dark">No Pending Self-Placements</h6>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="avatar-initial shadow-sm">{app.studentName?.charAt(0).toUpperCase() || 'S'}</div>
                          <div>
                            <div className="fw-bolder text-dark">{app.studentName}</div>
                            <div className="small text-muted font-monospace mt-1">ID: {app.studentId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="mb-2">
                          <span className="badge bg-primary bg-opacity-10 border px-3 py-1 rounded-pill text-primary">Self-Placement</span>
                        </div>
                        <div className="small text-muted fw-medium mt-1">
                          <i className="bi bi-diagram-3 me-1 text-primary"></i> {app.requestedWorkingArea || 'General'}
                        </div>
                      </td>
                      <td>
                        <div className="fw-bold text-primary"><i className="bi bi-building me-2"></i>{app.companyName}</div>
                        <div className="small text-muted mt-1"><i className="bi bi-geo-alt-fill text-danger me-1"></i> {app.location || 'Unknown Location'}</div>
                      </td>
                      <td className="text-end">
                        <button className="btn-action btn-approve w-100" onClick={() => promptSelfPlacement(app)} disabled={processingId === app.id}>
                          {processingId === app.id ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-check-all"></i> Verify</>}
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}

          {/* TAB 3: ACTIVE INTERNS */}
          {activeTab === 'Active' && (
            <>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Student Identity</th>
                  <th style={{ width: '30%' }}>Host Organization</th>
                  <th style={{ width: '25%' }}>Assigned Division</th>
                  <th className="text-end" style={{ width: '15%' }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5 text-muted">
                      <i className="bi bi-briefcase fs-1 d-block mb-3 opacity-50"></i>
                      <h6 className="fw-bold text-dark">No Active Interns</h6>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="avatar-initial shadow-sm" style={{background: '#F0FDF4', color: '#16A34A', borderColor: '#BBF7D0'}}>{app.studentName?.charAt(0).toUpperCase() || 'S'}</div>
                          <div>
                            <div className="fw-bolder text-dark">{app.studentName}</div>
                            <div className="small text-muted font-monospace mt-1">ID: {app.studentId}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        <div className="fw-bold text-dark"><i className="bi bi-building me-2 text-primary"></i> {app.companyName}</div>
                        <div className="small text-muted mt-1"><i className="bi bi-geo-alt-fill text-danger me-1"></i> {app.location || 'Location Not Specified'}</div>
                      </td>
                      <td>
                        <div className="fw-medium text-dark">{app.workingArea || <span className="text-muted fst-italic">Not Yet Defined</span>}</div>
                      </td>
                      <td className="text-end">
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill fw-bold">
                           Active in Field
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}

          {/* TAB 4: WEEKLY LOGS */}
          {activeTab === 'WeeklyLogs' && (
            <>
              <thead>
                <tr>
                  <th style={{ width: '20%' }}>Student</th>
                  <th style={{ width: '15%' }}>Log Week</th>
                  <th style={{ width: '40%' }}>Technical Activity Description</th>
                  <th className="text-end" style={{ width: '25%' }}>Review Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-warning"></div></td></tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5 text-muted">
                      <i className="bi bi-journal-check fs-1 d-block mb-3 opacity-50"></i>
                      <h6 className="fw-bold text-dark">No Pending Logs</h6>
                      <p className="small mb-0">All student logbook entries have been reviewed.</p>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((log) => (
                    <tr key={log.id}>
                      <td>
                        <div className="fw-bolder text-dark">{log.studentName}</div>
                        <div className="small text-muted fw-bold mt-1 text-primary">{log.hours} Hours Logged</div>
                      </td>
                      <td>
                        <span className="badge bg-dark bg-opacity-10 text-dark px-3 py-1 rounded-pill border fw-bold">Week {log.weekNumber}</span>
                        <div className="small text-muted mt-2 fw-medium">
                          {new Date(log.startDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})} - {new Date(log.endDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric'})}
                        </div>
                      </td>
                      <td>
                        <p className="mb-0 text-dark fw-medium" style={{ fontSize: '0.85rem', lineHeight: '1.5' }}>
                          {log.description}
                        </p>
                      </td>
                      <td className="text-end">
                        <div className="d-flex justify-content-end gap-2">
                          <button 
                            className="btn-action btn-reject px-3" 
                            onClick={() => promptLogAction(log, 'Rejected')} 
                            disabled={processingId === log.id}
                          >
                            <i className="bi bi-x-circle-fill"></i> Reject
                          </button>
                          <button 
                            className="btn-action btn-approve px-3" 
                            onClick={() => promptLogAction(log, 'Approved')} 
                            disabled={processingId === log.id}
                          >
                            <i className="bi bi-check-circle-fill"></i> Approve
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}

          {/* TAB 5: FINAL REVIEW */}
          {activeTab === 'Review' && (
            <>
              <thead>
                <tr>
                  <th style={{ width: '30%' }}>Student Identity</th>
                  <th style={{ width: '45%' }}>Deliverables (Report & Feedback)</th>
                  <th className="text-end" style={{ width: '25%' }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="3" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : filteredData.length === 0 ? (
                  <tr>
                    <td colSpan="3" className="text-center py-5 text-muted">
                      <i className="bi bi-file-earmark-pdf fs-1 d-block mb-3 opacity-50"></i>
                      <h6 className="fw-bold text-dark">No Students Awaiting Final Review</h6>
                    </td>
                  </tr>
                ) : (
                  filteredData.map((app) => (
                    <tr key={app.id}>
                      <td>
                        <div className="d-flex align-items-center gap-3">
                          <div className="avatar-initial shadow-sm bg-warning bg-opacity-10 text-warning border-warning">{app.studentName?.charAt(0).toUpperCase() || 'S'}</div>
                          <div>
                            <div className="fw-bolder text-dark">{app.studentName}</div>
                            <div className="small text-muted font-monospace mt-1">ID: {app.studentId}</div>
                          </div>
                        </div>
                      </td>
                      
                      <td>
                        <div className="mb-3">
                          {app.reportUrl ? (
                            <button 
                              type="button"
                              onClick={() => handleViewPdf(app.reportUrl)}
                              className="btn btn-sm btn-light border border-secondary fw-bold text-dark rounded-pill px-4 py-2 shadow-sm d-inline-flex align-items-center gap-2" 
                              style={{ transition: 'all 0.2s ease' }} 
                            >
                              <i className="bi bi-file-earmark-pdf-fill fs-5 text-danger"></i> View Official Report (PDF)
                            </button>
                          ) : (
                            <span className="text-danger small fw-bold"><i className="bi bi-exclamation-circle-fill me-1"></i> Student PDF Missing</span>
                          )}
                        </div>

                        {app.companyScore !== undefined ? (
                           <div className="p-3 bg-light border rounded-3">
                             <span className="badge bg-dark mb-2 px-3 py-2 rounded-pill">Company Score: {app.companyScore}/100</span>
                             <p className="small text-muted mb-0 fst-italic lh-sm">"{app.companyReport}"</p>
                           </div>
                        ) : (
                          <span className="badge bg-warning text-dark bg-opacity-25 border border-warning border-opacity-50 px-3 py-1">Awaiting Company Evaluation</span>
                        )}
                      </td>
                      
                      <td className="text-end">
                        <button 
                          className="btn-action btn-approve w-100 py-3" 
                          onClick={() => promptVerifyReport(app)} 
                          disabled={processingId === app.id || !app.reportUrl}
                        >
                          {processingId === app.id ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-check-circle-fill fs-5"></i> Verify & Forward</>}
                        </button>
                        <div className="text-muted small mt-2 fw-medium text-center">Forwards to Director</div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </>
          )}

        </table>
      </div>

      {/* --- UNIVERSAL CONFIRMATION MODAL --- */}
      {confirmModal.show && createPortal(
        <div className="glass-overlay" onClick={() => setConfirmModal({ show: false, config: null })}>
           <div className="glass-modal" onClick={e => e.stopPropagation()}>
             
             <div className="p-4 border-bottom text-center bg-light">
                <div className={`rounded-circle d-inline-flex align-items-center justify-content-center ${confirmModal.config.bgClass} bg-opacity-10 ${confirmModal.config.colorClass} mb-3`} style={{ width: '80px', height: '80px', fontSize: '2.5rem' }}>
                  <i className={`bi ${confirmModal.config.icon}`}></i>
                </div>
                <h4 className="fw-bolder text-dark m-0">{confirmModal.config.title}</h4>
             </div>
             
             <div className="p-4 p-md-5 bg-white text-center">
               <p className="text-muted fw-medium fs-5 mb-4">
                 {confirmModal.config.message}
               </p>
               
               <div className="row g-3">
                 <div className="col-6">
                   <button className="btn-cancel" onClick={() => setConfirmModal({ show: false, config: null })}>
                     Cancel
                   </button>
                 </div>
                 <div className="col-6">
                   <button 
                     className={`btn-confirm-modal d-flex align-items-center justify-content-center gap-2 ${confirmModal.config.type === 'LOG_ACTION' && confirmModal.config.actionData.action === 'Rejected' ? 'danger' : ''}`} 
                     onClick={executeModalAction}
                   >
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

export default DepartmentDashboard;