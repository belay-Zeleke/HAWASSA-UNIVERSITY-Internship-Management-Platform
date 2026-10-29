import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase-config';
import { collection, onSnapshot, query, doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const FinanceDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Pending"); // 'Pending' or 'Cleared'
  const [notification, setNotification] = useState({ type: '', message: '' });

  // --- NEW: Custom Modal States ---
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [appToDisburse, setAppToDisburse] = useState(null);

  const role = localStorage.getItem('role') || 'FinanceOfficer';
  const userName = localStorage.getItem('userName') || 'Finance Admin';

  const BUDGET_PER_STUDENT = 1500; 

  // 1. Real-Time Ledger Sync
  useEffect(() => {
    const q = query(collection(db, "applications"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ 
        id: doc.id, 
        ...doc.data() 
      }));
      
      apps.sort((a, b) => (b.financeProcessedAt?.seconds || b.submittedAt?.seconds || 0) - (a.financeProcessedAt?.seconds || a.submittedAt?.seconds || 0));
      
      setApplications(apps);
      setLoading(false);
    }, (error) => {
      console.error("Ledger Sync Error:", error);
      setNotification({ type: 'danger', message: 'Failed to securely connect to the financial ledger.' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Open Custom Modal
  const handleOpenDisburseModal = (app) => {
    setAppToDisburse(app);
    setShowConfirmModal(true);
  };

  // 3. Execute Financial Clearance (Called from the custom modal)
  const executeDisbursement = async () => {
    if (!appToDisburse) return;
    const app = appToDisburse;
    
    // Close Modal immediately
    setShowConfirmModal(false);
    setAppToDisburse(null);
    setProcessingId(app.id);
    setNotification({ type: '', message: '' });

    try {
      const appRef = doc(db, "applications", app.id);
      const transactionId = `TXN-${Math.floor(10000000 + Math.random() * 90000000)}`;
      
      await updateDoc(appRef, { 
        status: 'FinanceProcessed', 
        financeOfficerName: userName,
        transactionRef: transactionId,
        financeProcessedAt: serverTimestamp(),
        budgetAllocated: BUDGET_PER_STUDENT 
      });

      setNotification({ type: 'success', message: `Funds authorized and wired for ${app.studentName}. Pipeline Completed. (TXN: ${transactionId})` });
      setTimeout(() => setNotification({ type: '', message: '' }), 5000);
      
    } catch (err) {
      setNotification({ type: 'danger', message: `Transaction failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // 4. Financial Hold Logic (Reject)
  const handleFinancialHold = async (id, studentName) => {
    const isConfirmed = window.confirm(`Place a financial hold on ${studentName}? This will flag the application as Rejected due to financial/banking issues.`);
    if (!isConfirmed) return;

    setProcessingId(id);
    setNotification({ type: '', message: '' });

    try {
      const appRef = doc(db, "applications", id);
      
      await updateDoc(appRef, { 
        status: 'Rejected', 
        financeOfficerName: userName,
        financeRejectedAt: serverTimestamp()
      });

      setNotification({ type: 'warning', message: `Financial hold placed on ${studentName}.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
      
    } catch (err) {
      setNotification({ type: 'danger', message: `Hold failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // 5. Financial Analytics Engine
  const stats = useMemo(() => {
    const pendingCount = applications.filter(a => a.status === 'AcademicallyApproved').length;
    const clearedCount = applications.filter(a => a.status === 'FinanceProcessed').length;
    
    return {
      pending: pendingCount,
      cleared: clearedCount,
      totalDisbursed: clearedCount * BUDGET_PER_STUDENT,
      pendingLiability: pendingCount * BUDGET_PER_STUDENT,
      totalBudget: (pendingCount + clearedCount) * BUDGET_PER_STUDENT,
      clearanceRate: (pendingCount + clearedCount) > 0 ? Math.round((clearedCount / (pendingCount + clearedCount)) * 100) : 0
    };
  }, [applications]);

  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      const isPendingMatch = activeTab === 'Pending' && app.status === 'AcademicallyApproved';
      const isClearedMatch = activeTab === 'Cleared' && app.status === 'FinanceProcessed';
      const matchesTab = isPendingMatch || isClearedMatch;
        
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (app.studentName?.toLowerCase() || '').includes(searchLower) ||
        (app.studentId?.toLowerCase() || '').includes(searchLower) ||
        (app.bankAccount?.toLowerCase() || '').includes(searchLower) ||
        (app.transactionRef?.toLowerCase() || '').includes(searchLower); 
      
      return matchesTab && matchesSearch;
    });
  }, [applications, activeTab, searchTerm]);

  return (
    <Layout role={role} userName={userName}>
      
      <style>{`
        :root { --primary-finance: #001A33; --accent-gold: #FFCC00; --bg-soft: #F8FAFC; }
        .finance-header { margin-bottom: 2rem; }
        .ledger-card {
          background: #ffffff; border: 1px solid #E2E8F0; border-radius: 20px;
          padding: 1.5rem; display: flex; flex-direction: column; justify-content: center;
          box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.3s ease; position: relative;
          overflow: hidden;
        }
        .ledger-card::before { content: ''; position: absolute; top: 0; left: 0; width: 100%; height: 4px; }
        .ledger-card.border-primary::before { background: #0055FF; }
        .ledger-card.border-success::before { background: #10B981; }
        .ledger-card.border-warning::before { background: #F59E0B; }
        .ledger-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .currency-display { font-family: 'SF Pro Display', system-ui, sans-serif; letter-spacing: -1px; }
        .controls-bar {
          background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px;
          padding: 12px 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between;
          align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 1rem;
        }
        .nav-pills-custom .nav-link { color: #64748B; font-weight: 800; border-radius: 10px; padding: 10px 24px; transition: all 0.3s ease; cursor: pointer; border: none; background: transparent; }
        .nav-pills-custom .nav-link.active { background-color: var(--primary-finance); color: #ffffff; box-shadow: 0 4px 10px rgba(0, 26, 51, 0.2); }
        .search-input-wrapper { position: relative; width: 320px; }
        .search-input-wrapper i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94A3B8; }
        .search-input { width: 100%; padding: 12px 16px 12px 42px; border-radius: 12px; border: 1px solid #E2E8F0; background: var(--bg-soft); font-size: 0.95rem; transition: 0.3s; }
        .search-input:focus { background: #ffffff; border-color: #0055FF; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1.2rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; transition: 0.2s; }
        .premium-table tbody tr:hover td { background: var(--bg-soft); }
        .btn-action { font-weight: 700; border: none; border-radius: 10px; padding: 10px 20px; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px; }
        .btn-disburse { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
        .btn-disburse:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(16, 185, 129, 0.3); }
        .btn-reject { background: #F8FAFC; color: #EF4444; border: 1px solid #E2E8F0; }
        .btn-reject:hover:not(:disabled) { background: #FEF2F2; border-color: #FECACA; }
        .btn-action:disabled { opacity: 0.7; cursor: not-allowed; }
        .animate-fade { animation: slideUpFade 0.4s ease forwards; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="finance-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 no-print">
        <div>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Financial Operations</h2>
          <p className="text-muted mb-0 fw-medium">Authorize stipend disbursements for Academically-cleared placements.</p>
        </div>
        <button className="btn btn-white border fw-bold shadow-sm rounded-3 px-4 py-2 text-dark d-flex align-items-center gap-2" onClick={() => window.print()}>
          <i className="bi bi-file-earmark-spreadsheet-fill text-success"></i> Export Ledger
        </button>
      </div>

      {/* --- CUSTOM CONFIRMATION MODAL --- */}
      {showConfirmModal && appToDisburse && (
        <>
          <div className="modal-backdrop fade show" style={{ zIndex: 1040, backgroundColor: 'rgba(0, 14, 28, 0.6)', backdropFilter: 'blur(4px)' }}></div>
          <div className="modal fade show d-block" style={{ zIndex: 1050 }} tabIndex="-1">
            <div className="modal-dialog modal-dialog-centered">
              <div className="modal-content border-0 shadow-lg rounded-4 overflow-hidden">
                <div className="modal-header bg-light border-0 pb-0 pt-4 px-4">
                  <h5 className="modal-title fw-bolder text-dark">Confirm Disbursement</h5>
                  <button type="button" className="btn-close" onClick={() => setShowConfirmModal(false)}></button>
                </div>
                <div className="modal-body px-4 pt-4 pb-4">
                  <div className="d-flex align-items-center mb-3 p-3 bg-white border border-success border-opacity-25 rounded-3 shadow-sm">
                    <div className="bg-success bg-opacity-10 text-success rounded-circle d-flex justify-content-center align-items-center me-3 flex-shrink-0" style={{ width: '48px', height: '48px' }}>
                      <i className="bi bi-bank fs-4"></i>
                    </div>
                    <div>
                      <h4 className="fw-bolder text-dark mb-0">{BUDGET_PER_STUDENT.toLocaleString()} ETB</h4>
                      <div className="text-muted small fw-medium">Beneficiary: <span className="text-dark fw-bold">{appToDisburse.studentName}</span></div>
                    </div>
                  </div>
                  <p className="text-muted fw-medium mb-0" style={{ fontSize: '0.95rem' }}>
                    You are about to authorize this payment. This confirms the funds have been successfully wired to Account 
                    <strong className="text-dark font-monospace mx-1 px-1 bg-light rounded">{appToDisburse.bankAccount}</strong> 
                    and will officially complete the student's internship pipeline.
                  </p>
                </div>
                <div className="modal-footer border-0 pt-0 px-4 pb-4 bg-light d-flex gap-2 justify-content-end">
                  <button type="button" className="btn btn-white border fw-bold text-muted px-4 py-2" onClick={() => setShowConfirmModal(false)}>
                    Cancel
                  </button>
                  <button type="button" className="btn-action btn-disburse px-4 py-2 m-0" onClick={executeDisbursement}>
                    <i className="bi bi-shield-lock-fill fs-5"></i> Confirm & Authorize
                  </button>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* --- NOTIFICATIONS --- */}
      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {/* --- FINANCIAL ANALYTICS --- */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="ledger-card border-warning">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <p className="text-muted fw-bold text-uppercase small mb-0">Pending Liabilities</p>
              <i className="bi bi-clock-history text-warning fs-5"></i>
            </div>
            <h2 className="fw-bolder mb-2 text-dark currency-display">
              {stats.pendingLiability.toLocaleString()} <span className="fs-6 text-muted fw-bold">ETB</span>
            </h2>
            <div className="progress rounded-pill bg-light" style={{ height: '6px' }}>
              <div className="progress-bar bg-warning rounded-pill" style={{ width: `${100 - stats.clearanceRate}%` }}></div>
            </div>
            <div className="mt-2 small fw-medium text-muted">Waiting on {stats.pending} student disbursements</div>
          </div>
        </div>
        
        <div className="col-md-4">
          <div className="ledger-card border-success">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <p className="text-muted fw-bold text-uppercase small mb-0">Total Cleared Budget</p>
              <i className="bi bi-shield-fill-check text-success fs-5"></i>
            </div>
            <h2 className="fw-bolder mb-2 text-dark currency-display">
              {stats.totalDisbursed.toLocaleString()} <span className="fs-6 text-muted fw-bold">ETB</span>
            </h2>
            <div className="progress rounded-pill bg-light" style={{ height: '6px' }}>
              <div className="progress-bar bg-success rounded-pill" style={{ width: `${stats.clearanceRate}%` }}></div>
            </div>
            <div className="mt-2 small fw-medium text-success d-flex align-items-center">
              <i className="bi bi-check2-circle me-1"></i> {stats.cleared} students fully paid
            </div>
          </div>
        </div>

        <div className="col-md-4">
          <div className="ledger-card border-primary" style={{ background: 'linear-gradient(135deg, #001A33 0%, #000E1C 100%)' }}>
            <p className="text-white-50 fw-bold text-uppercase small mb-1">Approved Stipend Rate</p>
            <h2 className="fw-bolder mb-0 text-white currency-display">
              {BUDGET_PER_STUDENT.toLocaleString()} <span className="fs-5 text-white-50 fw-bold">ETB</span>
            </h2>
            <div className="mt-2 small fw-medium text-white-50 d-flex align-items-center border-top border-secondary pt-2">
              <i className="bi bi-bank me-1"></i> Flat rate per academic-cleared intern
            </div>
          </div>
        </div>
      </div>

      {/* --- CONTROLS BAR --- */}
      <div className="controls-bar no-print">
        <div className="d-flex nav-pills-custom gap-2">
          <button className={`nav-link ${activeTab === 'Pending' ? 'active' : ''}`} onClick={() => setActiveTab('Pending')}>
            Awaiting Disbursement {stats.pending > 0 && <span className="badge bg-danger rounded-pill ms-2">{stats.pending}</span>}
          </button>
          <button className={`nav-link ${activeTab === 'Cleared' ? 'active' : ''}`} onClick={() => setActiveTab('Cleared')}>
            Financial Archive
          </button>
        </div>
        <div className="search-input-wrapper">
          <i className="bi bi-search"></i>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search by name, ID, or TXN Ref..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      {/* --- FINANCIAL REGISTRY TABLE --- */}
      <div className="premium-table table-responsive mb-5 animate-fade">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: '25%' }}>Beneficiary Identity</th>
              <th style={{ width: '25%' }}>Banking Details</th>
              <th style={{ width: '20%' }}>Budget Requirement</th>
              <th className="text-end" style={{ width: '30%' }}>Financial Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan="4" className="text-center py-5">
                  <div className="spinner-border text-primary mb-3" role="status" style={{width: '3rem', height: '3rem'}}></div>
                  <div className="text-muted fw-medium">Accessing Secure Ledger...</div>
                </td>
              </tr>
            ) : filteredApps.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-5">
                  <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                    <i className={`bi ${activeTab === 'Pending' ? 'bi-wallet2 text-success' : 'bi-search text-muted'} fs-1`}></i>
                  </div>
                  <h5 className="text-dark fw-bold">{activeTab === 'Pending' ? 'No Pending Disbursements' : 'No Financial Records Found'}</h5>
                  <p className="text-muted small mb-0">
                    {activeTab === 'Pending' ? 'All Academically-approved students have been financially processed.' : 'Try adjusting your search criteria.'}
                  </p>
                </td>
              </tr>
            ) : (
              filteredApps.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div className="fw-bolder text-dark mb-1">{app.studentName}</div>
                    <div className="small text-muted fw-medium font-monospace">ID: {app.studentId || 'N/A'}</div>
                  </td>
                  <td>
                    <div className="fw-bold text-dark font-monospace"><i className="bi bi-credit-card-2-front me-2 text-primary"></i>{app.bankAccount || 'Not Provided'}</div>
                    <div className="small text-muted mt-1">{app.department}</div>
                  </td>
                  <td>
                    <span className="badge bg-light text-dark border px-3 py-2 rounded-pill fw-bold font-monospace shadow-sm" style={{ fontSize: '0.85rem' }}>
                      {BUDGET_PER_STUDENT.toLocaleString()} ETB
                    </span>
                  </td>
                  <td className="text-end">
                    {activeTab === 'Pending' ? (
                      <div className="d-flex justify-content-end gap-2">
                        <button 
                          className="btn-action btn-reject"
                          onClick={() => handleFinancialHold(app.id, app.studentName)}
                          disabled={processingId === app.id}
                        >
                          <i className="bi bi-slash-circle"></i> Hold
                        </button>
                        <button 
                          className="btn-action btn-disburse"
                          // --- NEW: Triggers the Custom Modal Instead ---
                          onClick={() => handleOpenDisburseModal(app)}
                          disabled={processingId === app.id}
                        >
                          {processingId === app.id ? (
                            <><span className="spinner-border spinner-border-sm"></span> Processing...</>
                          ) : (
                            <><i className="bi bi-shield-check"></i> Disburse Funds</>
                          )}
                        </button>
                      </div>
                    ) : (
                      <div className="d-flex flex-column align-items-end">
                        <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3 py-2 mb-2">
                          <i className="bi bi-check-circle-fill me-1"></i> Funds Disbursed
                        </span>
                        <div className="small text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
                          Ref: <strong className="text-dark">{app.transactionRef}</strong><br/>
                          {app.financeProcessedAt && (
                            <span className="opacity-75">On: {new Date(app.financeProcessedAt.seconds * 1000).toLocaleDateString()}</span>
                          )}
                        </div>
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

    </Layout>
  );
};

export default FinanceDashboard;