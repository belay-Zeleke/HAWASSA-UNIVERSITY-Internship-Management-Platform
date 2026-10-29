import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase-config';
import { collection, onSnapshot, query, where, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import Layout from '../components/Layout';
import { PieChart, Pie, Cell, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import 'bootstrap/dist/css/bootstrap.min.css';

const UILDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [companies, setCompanies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Overview"); 
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [processingId, setProcessingId] = useState(null);

  const [showModal, setShowModal] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [companyForm, setCompanyForm] = useState({ id: '', companyName: '', location: '', contactEmail: '', status: 'Active' });

  const role = localStorage.getItem('role') || 'UILOfficer';
  const userName = localStorage.getItem('userName') || 'UIL Admin';

  useEffect(() => {
    const qApps = query(collection(db, "applications"));
    const qComps = query(collection(db, "users"), where("role", "==", "CompanyRepresentative"));

    const unsubApps = onSnapshot(qApps, (snapshot) => {
      const apps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      apps.sort((a, b) => (b.submittedAt?.seconds || 0) - (a.submittedAt?.seconds || 0));
      setApplications(apps);
    });

    const unsubComps = onSnapshot(qComps, (snapshot) => {
      const comps = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCompanies(comps);
      setLoading(false);
    }, (error) => {
      console.error("UIL Sync Error:", error);
      setLoading(false);
    });

    return () => { unsubApps(); unsubComps(); };
  }, []);

  // --- UIL ACTION: Approve/Reject Company Requests ---
  const handleCompanyApproval = async (id, companyName, action) => {
    const newStatus = action === 'approve' ? 'Active' : 'Rejected';
    const isConfirmed = window.confirm(`Are you sure you want to ${action} the partnership request for ${companyName}?`);
    if (!isConfirmed) return;

    setProcessingId(id);
    try {
      await updateDoc(doc(db, "users", id), { accountStatus: newStatus });
      setNotification({ type: action === 'approve' ? 'success' : 'warning', message: `Company partnership ${action}d successfully.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (error) {
      setNotification({ type: 'danger', message: `Failed to process request: ${error.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  // --- MODAL ACTIONS ---
  const handleOpenModal = (company = null) => {
    if (company) {
      setEditMode(true);
      setCompanyForm({ 
        id: company.id, 
        companyName: company.companyName || '', 
        location: company.location || '', 
        contactEmail: company.email || '',
        status: company.accountStatus || 'Active' 
      });
    } else {
      setEditMode(false);
      setCompanyForm({ id: '', companyName: '', location: '', contactEmail: '', status: 'Active' });
    }
    setShowModal(true);
  };

  const handleSaveCompany = async (e) => {
    e.preventDefault();
    setProcessingId('saving');
    
    try {
      if (editMode) {
        const compRef = doc(db, "users", companyForm.id);
        await updateDoc(compRef, {
          companyName: companyForm.companyName,
          location: companyForm.location,
          email: companyForm.contactEmail,
          accountStatus: companyForm.status
        });
        setNotification({ type: 'success', message: 'Company profile updated successfully.' });
      } else {
        await addDoc(collection(db, "users"), {
          role: "CompanyRepresentative",
          companyName: companyForm.companyName,
          location: companyForm.location,
          email: companyForm.contactEmail,
          accountStatus: companyForm.status, // Can be set to 'Pending' for testing requests
          createdAt: serverTimestamp()
        });
        setNotification({ type: 'success', message: 'New partner company added to the registry.' });
      }
      setShowModal(false);
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (error) {
      setNotification({ type: 'danger', message: `Failed to save company: ${error.message}` });
    } finally {
      setProcessingId(null);
    }
  };

  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === 'Inactive' ? 'Active' : 'Inactive';
    if (!window.confirm(`Are you sure you want to mark this company as ${newStatus}?`)) return;

    try {
      await updateDoc(doc(db, "users", id), { accountStatus: newStatus });
      setNotification({ type: 'warning', message: `Company status changed to ${newStatus}.` });
      setTimeout(() => setNotification({ type: '', message: '' }), 4000);
    } catch (error) {
      setNotification({ type: 'danger', message: 'Failed to update status.' });
    }
  };

  // --- ANALYTICS & FILTERING ---
  const analytics = useMemo(() => {
    return {
      totalRegistered: applications.length,
      pendingPlacement: applications.filter(a => ['Registered', 'PendingDeptApproval'].includes(a.status)).length,
      assigned: applications.filter(a => a.status === 'Assigned').length,
      active: applications.filter(a => ['Active', 'CompanyEvaluated', 'ReportSubmitted'].includes(a.status)).length,
      completed: applications.filter(a => ['PendingAcademicApproval', 'AcademicallyApproved', 'FinanceProcessed', 'Completed'].includes(a.status)).length,
      
      activePartners: companies.filter(c => c.accountStatus === 'Active').length,
      pendingPartners: companies.filter(c => c.accountStatus === 'Pending').length,
      inactivePartners: companies.filter(c => c.accountStatus === 'Inactive').length
    };
  }, [applications, companies]);

  // Data for Recharts
  const pipelineData = [
    { name: 'Unassigned', value: analytics.pendingPlacement, color: '#94A3B8' },
    { name: 'Awaiting Company', value: analytics.assigned, color: '#F59E0B' },
    { name: 'Active Interns', value: analytics.active, color: '#0055FF' },
    { name: 'Finalized', value: analytics.completed, color: '#10B981' }
  ];

  const deptData = useMemo(() => {
    const depts = { 'Information Systems': 0, 'Information Technology': 0, 'Computer Science': 0 };
    applications.forEach(app => {
      if (depts[app.department] !== undefined) depts[app.department]++;
    });
    return Object.keys(depts).map(key => ({ name: key.replace('Information ', 'Info '), Students: depts[key] }));
  }, [applications]);

  const filteredData = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    
    if (activeTab === 'Requests') {
      return companies.filter(c => c.accountStatus === 'Pending' && ((c.companyName?.toLowerCase() || '').includes(searchLower) || (c.location?.toLowerCase() || '').includes(searchLower)));
    }
    if (activeTab === 'Partners') {
      return companies.filter(c => c.accountStatus !== 'Pending' && ((c.companyName?.toLowerCase() || '').includes(searchLower) || (c.location?.toLowerCase() || '').includes(searchLower)));
    }
    if (activeTab === 'Monitoring') {
      return applications.filter(a => !['Rejected', 'RejectedByCompany'].includes(a.status) && ((a.studentName?.toLowerCase() || '').includes(searchLower) || (a.companyName?.toLowerCase() || '').includes(searchLower)));
    }
    return [];
  }, [companies, applications, activeTab, searchTerm]);

  return (
    <Layout role={role} userName={userName}>
      
      <style>{`
        :root { --primary-uil: #001A33; --accent-uil: #0055FF; --bg-soft: #F8FAFC; }
        .uil-header { margin-bottom: 2rem; }
        
        .metric-card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1.5rem; position: relative; overflow: hidden; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.3s ease; }
        .metric-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .metric-icon { position: absolute; right: -15px; bottom: -15px; font-size: 6rem; opacity: 0.04; transform: rotate(-10deg); }
        .chart-card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 20px; padding: 2rem; box-shadow: 0 4px 12px rgba(0,0,0,0.02); height: 100%; }

        .controls-bar { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 12px 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 1rem; }
        .nav-pills-custom .nav-link { color: #64748B; font-weight: 800; border-radius: 10px; padding: 10px 20px; transition: all 0.2s ease; cursor: pointer; border: none; background: transparent; }
        .nav-pills-custom .nav-link.active { background-color: var(--primary-uil); color: #ffffff; box-shadow: 0 4px 10px rgba(0, 26, 51, 0.2); }

        .search-input-wrapper { position: relative; width: 280px; }
        .search-input-wrapper i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #94A3B8; }
        .search-input { width: 100%; padding: 10px 16px 10px 42px; border-radius: 12px; border: 1px solid #E2E8F0; background: var(--bg-soft); font-size: 0.9rem; transition: 0.3s; }
        .search-input:focus { background: #ffffff; border-color: var(--accent-uil); box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }

        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1.2rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
        .premium-table tbody tr:hover td { background: var(--bg-soft); }
        
        .avatar-initial { width: 42px; height: 42px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; border: 1px solid #BFDBFE; flex-shrink: 0; }
        
        .btn-add { background: var(--accent-uil); color: white; font-weight: 800; border: none; border-radius: 10px; padding: 10px 24px; transition: all 0.2s ease; box-shadow: 0 4px 10px rgba(0, 85, 255, 0.2); }
        .btn-add:hover { transform: translateY(-2px); box-shadow: 0 8px 20px rgba(0, 85, 255, 0.3); color: white; }
        
        .btn-action { font-weight: 700; border: none; border-radius: 10px; padding: 8px 20px; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 8px; }
        .btn-approve { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.2); }
        .btn-approve:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 6px 15px rgba(16, 185, 129, 0.3); color: white; }
        .btn-reject { background: #FEF2F2; color: #DC2626; border: 1px solid #FECACA; }
        .btn-reject:hover:not(:disabled) { background: #FEE2E2; border-color: #F87171; }
        .btn-action:disabled { opacity: 0.6; cursor: not-allowed; }

        /* Modal Styles */
        .glass-overlay { position: fixed; inset: 0; background: rgba(0, 14, 28, 0.6); backdrop-filter: blur(6px); z-index: 1050; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .glass-modal { background: rgba(255,255,255,0.98); border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.3); width: 100%; max-width: 500px; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        
        .floating-input { width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; border-radius: 12px; background: #F8FAFC; font-size: 0.95rem; color: #1E293B; transition: 0.2s; }
        .floating-input:focus { border-color: #0055FF; background: #fff; box-shadow: 0 0 0 4px rgba(0,85,255,0.1); outline: none; }
        .floating-label { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.95rem; pointer-events: none; transition: 0.2s; font-weight: 500; }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; font-size: 0.7rem; color: #0055FF; font-weight: 700; letter-spacing: 0.5px; }

        .animate-fade { animation: fadeIn 0.4s ease forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* --- HEADER --- */}
      <div className="uil-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 no-print">
        <div>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>University-Industry Linkage</h2>
          <p className="text-muted mb-0 fw-medium">Manage corporate partnerships and monitor student placements.</p>
        </div>
        <button className="btn btn-outline-primary border-2 fw-bold rounded-3 px-4 py-2 shadow-sm d-flex align-items-center gap-2" onClick={() => window.print()}>
          <i className="bi bi-printer-fill"></i> Export Analytics
        </button>
      </div>

      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-warning'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {/* --- TAB NAVIGATION --- */}
      <div className="controls-bar no-print">
        <div className="d-flex nav-pills-custom gap-2 overflow-auto pb-2 pb-md-0">
          <button className={`nav-link text-nowrap ${activeTab === 'Overview' ? 'active' : ''}`} onClick={() => setActiveTab('Overview')}>
            <i className="bi bi-pie-chart-fill me-2"></i> System Analytics
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'Requests' ? 'active' : ''}`} onClick={() => setActiveTab('Requests')}>
            <i className="bi bi-person-lines-fill me-2"></i> Partner Requests
            {analytics.pendingPartners > 0 && <span className="badge bg-danger rounded-pill ms-2">{analytics.pendingPartners}</span>}
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'Partners' ? 'active' : ''}`} onClick={() => setActiveTab('Partners')}>
            <i className="bi bi-buildings-fill me-2"></i> Directory
          </button>
          <button className={`nav-link text-nowrap ${activeTab === 'Monitoring' ? 'active' : ''}`} onClick={() => setActiveTab('Monitoring')}>
            <i className="bi bi-activity me-2"></i> Placements
          </button>
        </div>
        {activeTab !== 'Overview' && (
          <div className="search-input-wrapper mt-2 mt-md-0">
            <i className="bi bi-search"></i>
            <input type="text" className="search-input" placeholder="Search records..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          </div>
        )}
      </div>

      {/* --- TAB 1: SYSTEM OVERVIEW (Enhanced with Recharts) --- */}
      {activeTab === 'Overview' && (
        <div className="animate-fade">
          
          <div className="row g-4 mb-4">
            <div className="col-md-4">
              <div className="metric-card border-top border-4 border-primary">
                <i className="bi bi-people-fill metric-icon text-primary"></i>
                <h6 className="text-muted fw-bold text-uppercase mb-2">Total Students</h6>
                <h2 className="display-5 fw-bolder text-dark mb-0">{analytics.totalRegistered}</h2>
              </div>
            </div>
            <div className="col-md-4">
              <div className="metric-card border-top border-4 border-success">
                <i className="bi bi-buildings-fill metric-icon text-success"></i>
                <h6 className="text-muted fw-bold text-uppercase mb-2">Active Partners</h6>
                <h2 className="display-5 fw-bolder text-dark mb-0">{analytics.activePartners}</h2>
              </div>
            </div>
            <div className="col-md-4">
              <div className="metric-card border-top border-4 border-info">
                <i className="bi bi-check-circle-fill metric-icon text-info"></i>
                <h6 className="text-muted fw-bold text-uppercase mb-2">Finalized</h6>
                <h2 className="display-5 fw-bolder text-dark mb-0">{analytics.completed}</h2>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="chart-card">
                <h6 className="fw-bolder text-dark mb-4 border-bottom pb-2">Student Pipeline Distribution</h6>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <PieChart>
                      <Pie data={pipelineData} cx="50%" cy="50%" innerRadius={60} outerRadius={100} paddingAngle={5} dataKey="value">
                        {pipelineData.map((entry, index) => <Cell key={`cell-${index}`} fill={entry.color} />)}
                      </Pie>
                      <Tooltip formatter={(value) => [`${value} Students`, 'Count']} />
                      <Legend verticalAlign="bottom" height={36}/>
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
            
            <div className="col-lg-6">
              <div className="chart-card">
                <h6 className="fw-bolder text-dark mb-4 border-bottom pb-2">Registrations by Department</h6>
                <div style={{ width: '100%', height: 300 }}>
                  <ResponsiveContainer>
                    <BarChart data={deptData} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#64748B', fontSize: 12}} />
                      <YAxis axisLine={false} tickLine={false} tick={{fill: '#64748B'}} allowDecimals={false} />
                      <Tooltip cursor={{fill: '#F1F5F9'}} contentStyle={{borderRadius: '10px', border: 'none', boxShadow: '0 4px 10px rgba(0,0,0,0.1)'}} />
                      <Bar dataKey="Students" fill="#001A33" radius={[6, 6, 0, 0]} barSize={40} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </div>

        </div>
      )}

      {/* --- TAB 2: PARTNER REQUESTS --- */}
      {activeTab === 'Requests' && (
        <div className="premium-table table-responsive animate-fade">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: '35%' }}>Organization Requesting Partnership</th>
                <th style={{ width: '25%' }}>Location</th>
                <th style={{ width: '20%' }}>Status</th>
                <th className="text-end" style={{ width: '20%' }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr> : filteredData.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-5 text-muted">
                  <i className="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                  <h6 className="fw-bold text-dark">No Pending Requests</h6>
                  <p className="small mb-0">There are no new companies applying for partnership.</p>
                </td></tr>
              ) : filteredData.map((comp) => (
                <tr key={comp.id}>
                  <td>
                    <div className="d-flex align-items-center gap-3">
                      <div className="avatar-initial">{comp.companyName?.charAt(0).toUpperCase() || 'C'}</div>
                      <div>
                        <div className="fw-bolder text-dark">{comp.companyName || 'Unnamed Company'}</div>
                        <div className="small text-muted fw-medium">{comp.email || 'No contact email'}</div>
                      </div>
                    </div>
                  </td>
                  <td><span className="fw-bold text-dark"><i className="bi bi-geo-alt-fill text-danger me-1"></i> {comp.location || 'N/A'}</span></td>
                  <td><span className="badge bg-warning bg-opacity-10 text-warning border border-warning px-3 py-2 rounded-pill text-dark">Awaiting Review</span></td>
                  <td className="text-end">
                    <div className="d-flex justify-content-end gap-2">
                      <button className="btn-action btn-reject" onClick={() => handleCompanyApproval(comp.id, comp.companyName, 'reject')} disabled={processingId === comp.id}>
                        <i className="bi bi-x-lg"></i> Decline
                      </button>
                      <button className="btn-action btn-approve" onClick={() => handleCompanyApproval(comp.id, comp.companyName, 'approve')} disabled={processingId === comp.id}>
                        <i className="bi bi-check-lg"></i> Approve
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- TAB 3: PARTNERS DIRECTORY --- */}
      {activeTab === 'Partners' && (
        <div className="animate-fade">
          <div className="d-flex justify-content-end mb-3">
            <button className="btn-add" onClick={() => handleOpenModal()}>
              <i className="bi bi-plus-lg me-2"></i> Add New Partner
            </button>
          </div>
          <div className="premium-table table-responsive">
            <table className="table align-middle mb-0">
              <thead>
                <tr>
                  <th style={{ width: '35%' }}>Organization</th>
                  <th style={{ width: '25%' }}>HQ Location</th>
                  <th style={{ width: '20%' }}>System Status</th>
                  <th className="text-end" style={{ width: '20%' }}>Management</th>
                </tr>
              </thead>
              <tbody>
                {loading ? <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr> : filteredData.length === 0 ? (
                  <tr><td colSpan="4" className="text-center py-5 text-muted">No active or inactive companies found matching criteria.</td></tr>
                ) : filteredData.map((comp) => (
                  <tr key={comp.id}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <div className="avatar-initial">{comp.companyName?.charAt(0).toUpperCase() || 'C'}</div>
                        <div>
                          <div className="fw-bolder text-dark">{comp.companyName || 'Unnamed Company'}</div>
                          <div className="small text-muted fw-medium">{comp.email || 'No contact email'}</div>
                        </div>
                      </div>
                    </td>
                    <td><span className="fw-bold text-dark"><i className="bi bi-geo-alt-fill text-danger me-1"></i> {comp.location || 'N/A'}</span></td>
                    <td>
                      <span className={`badge ${comp.accountStatus === 'Inactive' ? 'bg-danger' : 'bg-success'} bg-opacity-10 ${comp.accountStatus === 'Inactive' ? 'text-danger border-danger' : 'text-success border-success'} border px-3 py-2 rounded-pill`}>
                        {comp.accountStatus === 'Inactive' ? 'Deactivated' : 'Active Partner'}
                      </span>
                    </td>
                    <td className="text-end">
                      <div className="d-flex justify-content-end gap-2">
                        <button className="btn btn-sm btn-light border shadow-sm fw-bold text-primary px-3" onClick={() => handleOpenModal(comp)}>Edit</button>
                        <button 
                          className={`btn btn-sm ${comp.accountStatus === 'Inactive' ? 'btn-success' : 'btn-outline-danger'} shadow-sm fw-bold px-3`} 
                          onClick={() => handleToggleStatus(comp.id, comp.accountStatus)}
                        >
                          {comp.accountStatus === 'Inactive' ? 'Activate' : 'Deactivate'}
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* --- TAB 4: PLACEMENT MONITORING --- */}
      {activeTab === 'Monitoring' && (
        <div className="premium-table table-responsive animate-fade">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: '25%' }}>Student Name</th>
                <th style={{ width: '20%' }}>Department</th>
                <th style={{ width: '30%' }}>Host Organization</th>
                <th className="text-end" style={{ width: '25%' }}>Current Status</th>
              </tr>
            </thead>
            <tbody>
              {loading ? <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr> : filteredData.length === 0 ? (
                <tr><td colSpan="4" className="text-center py-5 text-muted">No placements found matching criteria.</td></tr>
              ) : filteredData.map((app) => (
                <tr key={app.id}>
                  <td>
                    <div className="fw-bolder text-dark">{app.studentName}</div>
                    <div className="small text-muted font-monospace mt-1">ID: {app.studentId}</div>
                  </td>
                  <td><span className="badge bg-light text-dark border px-3 py-2 rounded-pill fw-bold">{app.department}</span></td>
                  <td><div className="fw-bold text-primary"><i className="bi bi-building me-1"></i> {app.companyName || 'Not Assigned'}</div></td>
                  <td className="text-end">
                    <span className={`badge bg-secondary bg-opacity-10 text-secondary border px-3 py-2 rounded-pill fw-bold`}>
                      {app.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* --- ADD/EDIT COMPANY MODAL --- */}
      {showModal && (
        <div className="glass-overlay">
          <div className="glass-modal">
            
            <div className="p-4 border-bottom bg-light">
              <div className="d-flex justify-content-between align-items-center">
                <div>
                  <h4 className="fw-bolder text-dark mb-1">{editMode ? 'Edit Partner Profile' : 'Register New Partner'}</h4>
                  <p className="text-muted small mb-0">Manage corporate linkage details.</p>
                </div>
                <button className="btn btn-white border rounded-circle shadow-sm" onClick={() => setShowModal(false)}><i className="bi bi-x-lg"></i></button>
              </div>
            </div>

            <div className="p-4 p-md-5">
              <form onSubmit={handleSaveCompany}>
                <div className="position-relative mb-4">
                  <input type="text" className="floating-input" placeholder=" " value={companyForm.companyName} onChange={(e) => setCompanyForm({...companyForm, companyName: e.target.value})} required />
                  <label className="floating-label">Organization Name</label>
                </div>

                <div className="position-relative mb-4">
                  <input type="text" className="floating-input" placeholder=" " value={companyForm.location} onChange={(e) => setCompanyForm({...companyForm, location: e.target.value})} required />
                  <label className="floating-label">Headquarters / Location</label>
                </div>

                <div className="position-relative mb-4">
                  <input type="email" className="floating-input" placeholder=" " value={companyForm.contactEmail} onChange={(e) => setCompanyForm({...companyForm, contactEmail: e.target.value})} required />
                  <label className="floating-label">Primary Contact Email</label>
                </div>
                
                {/* UIL can test adding "Pending" companies manually */}
                {!editMode && (
                  <div className="position-relative mb-5">
                    <select className="floating-input bg-white fw-bold text-primary" style={{ appearance: 'none', cursor: 'pointer' }} value={companyForm.status} onChange={(e) => setCompanyForm({...companyForm, status: e.target.value})}>
                      <option value="Active">Active (Auto-Approve)</option>
                      <option value="Pending">Pending (Test Request Queue)</option>
                    </select>
                    <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem' }}>Initial Partnership Status</label>
                    <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                  </div>
                )}

                <div className="d-flex gap-2">
                  <button type="button" className="btn btn-light fw-bold w-50 py-3 rounded-3" onClick={() => setShowModal(false)}>Cancel</button>
                  <button type="submit" className="btn-add w-50 py-3 d-flex justify-content-center" disabled={processingId === 'saving'}>
                    {processingId === 'saving' ? <span className="spinner-border spinner-border-sm"></span> : (editMode ? 'Update Profile' : 'Register Partner')}
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

export default UILDashboard;