import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db } from '../firebase-config';
import { collection, query, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const AdminDashboard = () => {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);
  const [activeTab, setActiveTab] = useState("Pending"); 
  const [searchTerm, setSearchTerm] = useState(""); 
  const [notification, setNotification] = useState({ type: '', message: '' });

  const [confirmModal, setConfirmModal] = useState({ show: false, config: null });

  const role = localStorage.getItem('role') || 'Admin';
  const userName = localStorage.getItem('userName') || 'System Administrator';

  // 1. Fetch System Users (EXCLUDING COMPANIES)
  useEffect(() => {
    const q = query(collection(db, "users"));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const userData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      
      // === SECURITY UPDATE: Isolate Corporate Accounts ===
      // The Admin will no longer see or be able to manage 'CompanyRepresentative' accounts.
      // This forces the UIL office to be the sole approver of external partners.
      const internalUsers = userData.filter(user => user.role !== 'CompanyRepresentative');
      
      // Sort so newest registered users appear first
      internalUsers.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
      setUsers(internalUsers);
      setLoading(false);
    }, (error) => {
      console.error("User Sync Error:", error);
      setNotification({ type: 'danger', message: 'Failed to securely connect to the database.' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // --- MODAL PROMPT TRIGGER ---
  const promptAction = (user, actionType) => {
    const isApprove = actionType === 'Approve' || actionType === 'Restore';
    
    let title = 'Manage Account';
    if (actionType === 'Approve') title = 'Approve System Access';
    if (actionType === 'Restore') title = 'Restore Account Access';
    if (actionType === 'Deactivate') title = 'Deactivate Account';
    if (actionType === 'Reject') title = 'Reject Account Request';

    setConfirmModal({
      show: true,
      config: {
        type: isApprove ? 'APPROVE' : 'REJECT',
        title: title,
        message: isApprove 
          ? `Are you sure you want to grant ${user.name} access to the system as a ${user.role}?`
          : `Are you sure you want to revoke access for ${user.name}? They will no longer be able to log in.`,
        icon: isApprove ? 'bi-shield-check' : 'bi-shield-x',
        colorClass: isApprove ? 'text-success' : 'text-danger',
        bgClass: isApprove ? 'bg-success' : 'bg-danger',
        actionData: user
      }
    });
  };

  // --- EXECUTORS (Called by the Modal) ---
  const executeModalAction = async () => {
    const { type, actionData } = confirmModal.config;
    setConfirmModal({ show: false, config: null }); 

    if (type === 'APPROVE') {
      await processApproveUser(actionData.id, actionData.name, actionData.role);
    } else if (type === 'REJECT') {
      await processRejectUser(actionData.id, actionData.name);
    }
  };

  // 2. Approve Account Logic
  const processApproveUser = async (userId, userName, userRole) => {
    setProcessingId(userId);
    setNotification({ type: '', message: '' });

    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { 
        accountStatus: 'Active',
        approvedAt: new Date()
      });

      setNotification({ type: 'success', message: `${userName}'s ${userRole} account has been successfully activated.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Activation failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // 3. Reject/Deactivate Account Logic
  const processRejectUser = async (userId, userName) => {
    setProcessingId(userId);
    setNotification({ type: '', message: '' });

    try {
      const userRef = doc(db, "users", userId);
      await updateDoc(userRef, { 
        accountStatus: 'Rejected' 
      });

      setNotification({ type: 'warning', message: `${userName}'s account access has been revoked.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (err) {
      setNotification({ type: 'danger', message: `Action failed: ${err.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // Derived Analytics & Filtering
  const filteredUsers = useMemo(() => {
    const lowerSearch = searchTerm.toLowerCase();
    return users.filter(u => 
      (u.name?.toLowerCase() || '').includes(lowerSearch) ||
      (u.email?.toLowerCase() || '').includes(lowerSearch) ||
      (u.role?.toLowerCase() || '').includes(lowerSearch)
    );
  }, [users, searchTerm]);

  const pendingUsers = filteredUsers.filter(u => u.accountStatus === 'Pending');
  const activeUsers = filteredUsers.filter(u => u.accountStatus === 'Active');
  const rejectedUsers = filteredUsers.filter(u => u.accountStatus === 'Rejected');

  return (
    <Layout role={role} userName={userName}>
      
      <style>{`
        :root { --primary-admin: #4F46E5; --bg-soft: #F8FAFC; }
        .admin-header { margin-bottom: 2rem; border-left: 4px solid var(--primary-admin); padding-left: 1.5rem; }
        
        .stat-card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .stat-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }

        .controls-bar { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 12px 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 1rem; }
        .nav-pills-custom .nav-link { color: #64748B; font-weight: 700; border-radius: 10px; padding: 10px 20px; transition: all 0.2s ease; cursor: pointer; border: none; background: transparent; }
        .nav-pills-custom .nav-link.active { background-color: var(--primary-admin); color: #ffffff; box-shadow: 0 4px 10px rgba(79, 70, 229, 0.3); }

        .search-input-wrapper { position: relative; width: 300px; }
        .search-input-wrapper i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94A3B8; }
        .search-input { width: 100%; padding: 10px 16px 10px 42px; border-radius: 12px; border: 1px solid #E2E8F0; background: var(--bg-soft); font-size: 0.95rem; transition: 0.3s; }
        .search-input:focus { background: #ffffff; border-color: var(--primary-admin); box-shadow: 0 0 0 4px rgba(79, 70, 229, 0.1); outline: none; }
        
        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; transition: 0.2s; }
        .premium-table tbody tr:hover td { background: var(--bg-soft); }

        .btn-action { font-weight: 700; border: none; border-radius: 10px; padding: 8px 24px; transition: all 0.2s ease; display: inline-flex; align-items: center; justify-content: center; gap: 8px;}
        .btn-approve { background: #10B981; color: white; }
        .btn-approve:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3); }
        .btn-reject { background: #EF4444; color: white; }
        .btn-reject:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(239, 68, 68, 0.3); }
        .btn-action:disabled { opacity: 0.7; cursor: not-allowed; }

        .avatar-initial { width: 42px; height: 42px; border-radius: 50%; background: #EEF2FF; color: #4F46E5; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; border: 1px solid #C7D2FE; flex-shrink: 0; }
        
        .animate-fade { animation: slideUpFade 0.4s ease forwards; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }

        /* MODAL STYLES */
        .glass-overlay { position: fixed; inset: 0; background: rgba(0, 14, 28, 0.7); backdrop-filter: blur(8px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; opacity: 0; animation: fadeIn 0.3s forwards; }
        .glass-modal { background: #ffffff; border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.4); width: 100%; max-width: 500px; overflow: hidden; animation: slideUpModal 0.4s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255,255,255,0.8); }
        @keyframes fadeIn { to { opacity: 1; } }
        @keyframes slideUpModal { from { opacity: 0; transform: translateY(40px) scale(0.95); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .btn-cancel { background: #F1F5F9; color: #64748B; font-weight: 800; border: none; border-radius: 12px; padding: 14px 24px; transition: 0.2s; width: 100%; }
        .btn-cancel:hover { background: #E2E8F0; color: #1E293B; }
        .btn-confirm-modal { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 14px 24px; transition: 0.3s; box-shadow: 0 4px 15px rgba(16, 185, 129, 0.2); width: 100%; }
        .btn-confirm-modal:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(16, 185, 129, 0.4); }
        .btn-confirm-modal.danger { background: linear-gradient(135deg, #EF4444 0%, #DC2626 100%); box-shadow: 0 4px 15px rgba(239, 68, 68, 0.2); }
        .btn-confirm-modal.danger:hover { transform: translateY(-2px); box-shadow: 0 8px 25px rgba(239, 68, 68, 0.4); }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="admin-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3">
        <div>
          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-3 py-2 rounded-pill fw-bolder text-uppercase mb-2" style={{ letterSpacing: '1px' }}>
            System Security & Access
          </span>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Account Management Portal</h2>
          <p className="text-muted mb-0 fw-medium">Review, approve, and manage internal system access.</p>
        </div>
      </div>

      {/* --- NOTIFICATIONS --- */}
      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-warning'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {/* --- SYSTEM METRICS --- */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-warning bg-opacity-10 text-warning"><i className="bi bi-person-lock"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Internal Pending</p>
              <h2 className="fw-bolder mb-0 text-dark">{pendingUsers.length}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-success bg-opacity-10 text-success"><i className="bi bi-people-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Internal Active</p>
              <h2 className="fw-bolder mb-0 text-dark">{activeUsers.length}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-primary bg-opacity-10 text-primary" style={{ color: 'var(--primary-admin) !important' }}><i className="bi bi-shield-lock-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Total Internal Managed</p>
              <h2 className="fw-bolder mb-0 text-dark">{users.length}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* --- CONTROLS BAR --- */}
      <div className="controls-bar">
        <div className="d-flex nav-pills-custom gap-2 overflow-auto pb-2 pb-md-0">
          <button className={`nav-link text-nowrap ${activeTab === 'Pending' ? 'active' : ''}`} onClick={() => setActiveTab('Pending')}>
            Pending Registration
            {pendingUsers.length > 0 && <span className="badge bg-danger rounded-pill ms-2">{pendingUsers.length}</span>}
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'Active' ? 'active' : ''}`} onClick={() => setActiveTab('Active')}>
            Active Accounts
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'Rejected' ? 'active' : ''}`} onClick={() => setActiveTab('Rejected')}>
            Rejected Accounts
          </button>
        </div>
        <div className="search-input-wrapper mt-2 mt-md-0">
          <i className="bi bi-search"></i>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search internal users..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* --- DATA GRIDS --- */}
      <div className="premium-table table-responsive mb-5 animate-fade">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>User Profile</th>
              <th style={{ width: '25%' }}>System Role</th>
              <th style={{ width: '25%' }}>Account Status</th>
              <th className="text-end" style={{ width: '20%' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
            ) : (activeTab === 'Pending' ? pendingUsers : activeTab === 'Active' ? activeUsers : rejectedUsers).length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-5 text-muted">
                  <i className={`bi ${activeTab === 'Pending' ? 'bi-shield-check' : 'bi-inbox'} fs-1 d-block mb-3 opacity-50`}></i>
                  <h6 className="fw-bold text-dark">No {activeTab} Accounts</h6>
                  <p className="small mb-0">There are currently no internal accounts in this category.</p>
                </td>
              </tr>
            ) : (
              (activeTab === 'Pending' ? pendingUsers : activeTab === 'Active' ? activeUsers : rejectedUsers).map((user) => (
                <tr key={user.id}>
                  <td>
                    <div className="d-flex align-items-center gap-3">
                      <div className="avatar-initial shadow-sm">{user.name?.charAt(0).toUpperCase() || 'U'}</div>
                      <div>
                        <div className="fw-bolder text-dark">{user.name || 'Unknown User'}</div>
                        <div className="small text-muted mt-1"><i className="bi bi-envelope me-1"></i>{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="badge bg-dark bg-opacity-10 text-dark border border-dark border-opacity-25 px-3 py-2 rounded-pill fw-bold">
                      {user.role}
                    </span>
                  </td>
                  <td>
                    {user.accountStatus === 'Pending' && <span className="text-warning fw-bold"><i className="bi bi-hourglass-split me-1"></i> Awaiting Approval</span>}
                    {user.accountStatus === 'Active' && <span className="text-success fw-bold"><i className="bi bi-check-circle-fill me-1"></i> Verified & Active</span>}
                    {user.accountStatus === 'Rejected' && <span className="text-danger fw-bold"><i className="bi bi-x-circle-fill me-1"></i> Access Denied</span>}
                  </td>
                  <td className="text-end">
                    {user.accountStatus === 'Pending' && (
                      <div className="d-flex justify-content-end gap-2">
                        <button className="btn-action btn-reject" onClick={() => promptAction(user, 'Reject')} disabled={processingId === user.id}>
                          <i className="bi bi-x-lg"></i>
                        </button>
                        <button className="btn-action btn-approve" onClick={() => promptAction(user, 'Approve')} disabled={processingId === user.id}>
                          <i className="bi bi-check-lg"></i> Approve Access
                        </button>
                      </div>
                    )}
                    {user.accountStatus === 'Active' && (
                       <button className="btn-action btn-reject px-3" onClick={() => promptAction(user, 'Deactivate')} disabled={processingId === user.id}>
                         <i className="bi bi-slash-circle me-1"></i> Deactivate
                       </button>
                    )}
                    {user.accountStatus === 'Rejected' && (
                       <button className="btn-action btn-approve px-3" onClick={() => promptAction(user, 'Restore')} disabled={processingId === user.id}>
                         <i className="bi bi-arrow-counterclockwise me-1"></i> Restore Access
                       </button>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
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
                     className={`btn-confirm-modal d-flex align-items-center justify-content-center gap-2 ${confirmModal.config.type === 'REJECT' ? 'danger' : ''}`} 
                     onClick={executeModalAction}
                   >
                     <i className="bi bi-check-all fs-5"></i> Confirm Action
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

export default AdminDashboard;