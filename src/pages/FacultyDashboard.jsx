import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase-config';
import { collection, onSnapshot, query } from 'firebase/firestore';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const FacultyDashboard = () => {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeTab, setActiveTab] = useState("Monitoring"); // Default to Monitoring now
  const [notification, setNotification] = useState({ type: '', message: '' });

  const role = localStorage.getItem('role') || 'FacultyOfficer';
  const userName = localStorage.getItem('userName') || 'Faculty Admin';

  // 1. Fetch All Applications for Complete Oversight
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
      console.error("Faculty Sync Error:", error);
      setNotification({ type: 'danger', message: 'Failed to securely connect to the central registry.' });
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  // 2. Advanced Analytics & Oversight Engine
  const oversight = useMemo(() => {
    const total = applications.length;
    const activePlacements = applications.filter(a => a.status === 'Active').length;
    const completed = applications.filter(a => ['FinanceProcessed', 'Completed', 'AcademicallyApproved'].includes(a.status)).length;
    
    // Extract unique active companies for monitoring
    const uniqueCompanies = new Set();
    const deptMatrix = {
      'Information Systems': 0,
      'Information Technology': 0,
      'Computer Science': 0
    };

    applications.forEach(app => {
      if (app.companyName && app.companyName !== 'Awaiting Department Assignment') {
        uniqueCompanies.add(app.companyName);
      }
      if (app.department && deptMatrix[app.department] !== undefined) {
        deptMatrix[app.department]++;
      }
    });

    const completionRate = total > 0 ? Math.round((completed / total) * 100) : 0;

    return { 
      total, 
      activePlacements,
      completed,
      activeCompanies: uniqueCompanies.size,
      completionRate,
      deptMatrix 
    };
  }, [applications]);

  const filteredApps = useMemo(() => {
    return applications.filter(app => {
      // Hide standard table on Monitoring tab
      if (activeTab === 'Monitoring') return false; 
      
      const searchLower = searchTerm.toLowerCase();
      const matchesSearch = 
        (app.studentName?.toLowerCase() || '').includes(searchLower) ||
        (app.department?.toLowerCase() || '').includes(searchLower) ||
        (app.studentId?.toLowerCase() || '').includes(searchLower) ||
        (app.companyName?.toLowerCase() || '').includes(searchLower);
      
      return matchesSearch;
    });
  }, [applications, activeTab, searchTerm]);

  return (
    <Layout role={role} userName={userName}>
      
      <style>{`
        :root { --primary-faculty: #4338CA; --primary-dark: #312E81; --bg-soft: #EEF2FF; }

        .faculty-header { margin-bottom: 2rem; }
        
        .stat-card {
          background: #ffffff; border: 1px solid #E0E7FF; border-radius: 16px;
          padding: 1.5rem; display: flex; align-items: center; gap: 1rem;
          box-shadow: 0 4px 12px rgba(67, 56, 202, 0.03); transition: all 0.3s ease;
          position: relative; overflow: hidden;
        }
        .stat-card::after {
          content: ''; position: absolute; left: 0; bottom: 0; height: 4px; width: 0%;
          background: var(--primary-faculty); transition: 0.4s ease;
        }
        .stat-card:hover::after { width: 100%; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(67, 56, 202, 0.08); border-color: #C7D2FE; }
        .stat-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }

        .controls-bar {
          background: #ffffff; border: 1px solid #E0E7FF; border-radius: 16px;
          padding: 12px 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between;
          align-items: center; box-shadow: 0 2px 8px rgba(67, 56, 202, 0.02); flex-wrap: wrap; gap: 1rem;
        }
        
        .nav-pills-custom .nav-link { color: #6B7280; font-weight: 700; border-radius: 10px; padding: 10px 24px; transition: all 0.2s ease; cursor: pointer; border: none; background: transparent; }
        .nav-pills-custom .nav-link.active { background-color: var(--primary-faculty); color: #ffffff; box-shadow: 0 4px 10px rgba(67, 56, 202, 0.25); }

        .search-input-wrapper { position: relative; width: 320px; }
        .search-input-wrapper i { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); color: #9CA3AF; }
        .search-input { width: 100%; padding: 12px 16px 12px 42px; border-radius: 12px; border: 1px solid #E0E7FF; background: var(--bg-soft); font-size: 0.95rem; transition: 0.3s; }
        .search-input:focus { background: #ffffff; border-color: var(--primary-faculty); box-shadow: 0 0 0 4px rgba(67, 56, 202, 0.1); outline: none; }

        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E0E7FF; overflow: hidden; box-shadow: 0 4px 20px rgba(67, 56, 202, 0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #4F46E5; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #C7D2FE; padding: 1rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F3F4F6; color: #1F2937; transition: 0.2s; }
        .premium-table tbody tr:hover td { background: #F9FAFB; }

        .monitor-card { background: #ffffff; border: 1px solid #E0E7FF; border-radius: 16px; padding: 2rem; height: 100%; box-shadow: 0 4px 12px rgba(67, 56, 202, 0.03); }
        .monitor-list-item { padding: 1rem 0; border-bottom: 1px solid #F3F4F6; display: flex; justify-content: space-between; align-items: center; }
        .monitor-list-item:last-child { border-bottom: none; }

        .avatar-initial { width: 42px; height: 42px; border-radius: 50%; background: var(--bg-soft); color: var(--primary-faculty); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; border: 1px solid #C7D2FE; flex-shrink: 0; }
        
        .animate-fade { animation: slideUpFade 0.4s ease forwards; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* --- PAGE HEADER --- */}
      <div className="faculty-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 no-print">
        <div>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Faculty Oversight Hub</h2>
          <p className="text-muted mb-0 fw-medium">Monitor activities, institutional placements, and generate summary reports.</p>
        </div>
        <button className="btn btn-white border fw-bold shadow-sm rounded-3 px-4 py-2 text-dark d-flex align-items-center gap-2" onClick={() => window.print()} style={{ borderColor: '#C7D2FE' }}>
          <i className="bi bi-file-earmark-bar-graph-fill text-primary"></i> Generate Summary Report
        </button>
      </div>

      {/* --- NOTIFICATIONS --- */}
      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-danger'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {/* --- FACULTY OVERSIGHT METRICS --- */}
      <div className="row g-4 mb-4">
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-primary bg-opacity-10 text-primary"><i className="bi bi-people-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Total Processing</p>
              <h2 className="fw-bolder mb-0 text-dark">{oversight.total}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-info bg-opacity-10 text-info"><i className="bi bi-buildings"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Companies Monitored</p>
              <h2 className="fw-bolder mb-0 text-dark">{oversight.activeCompanies}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card" style={{ background: 'linear-gradient(135deg, #4338CA 0%, #312E81 100%)' }}>
            <div className="stat-icon bg-white bg-opacity-10 text-white"><i className="bi bi-bar-chart-line"></i></div>
            <div>
              <p className="text-white-50 fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Completion Rate</p>
              <h2 className="fw-bolder mb-0 text-white">{oversight.completionRate}%</h2>
            </div>
          </div>
        </div>
      </div>

      {/* --- CONTROLS BAR (Tabs & Search) --- */}
      <div className="controls-bar no-print">
        <div className="d-flex nav-pills-custom gap-2">
          <button className={`nav-link ${activeTab === 'Monitoring' ? 'active' : ''}`} onClick={() => setActiveTab('Monitoring')}>
            <i className="bi bi-activity me-2"></i> Institutional Monitor
          </button>
          <button className={`nav-link ${activeTab === 'Archive' ? 'active' : ''}`} onClick={() => setActiveTab('Archive')}>
            <i className="bi bi-archive me-2"></i> Master Archive
          </button>
        </div>
        
        {activeTab !== 'Monitoring' && (
          <div className="search-input-wrapper">
            <i className="bi bi-search"></i>
            <input 
              type="text" 
              className="search-input" 
              placeholder="Search by student, ID, or company..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        )}
      </div>

      {/* --- TAB CONTENT: INSTITUTIONAL MONITORING --- */}
      {activeTab === 'Monitoring' && (
        <div className="row g-4 mb-5 animate-fade">
          <div className="col-lg-6">
            <div className="monitor-card">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="fw-bolder text-dark mb-0"><i className="bi bi-diagram-3-fill text-primary me-2"></i> Departmental Activity</h5>
                <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 rounded-pill px-3">Active Load</span>
              </div>
              
              {Object.entries(oversight.deptMatrix).map(([dept, count]) => (
                <div className="monitor-list-item" key={dept}>
                  <div>
                    <div className="fw-bold text-dark">{dept}</div>
                    <div className="small text-muted">Total processed applications</div>
                  </div>
                  <div className="fw-bolder fs-4 text-primary">{count}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="col-lg-6">
            <div className="monitor-card">
              <div className="d-flex justify-content-between align-items-center mb-4">
                <h5 className="fw-bolder text-dark mb-0"><i className="bi bi-briefcase-fill text-success me-2"></i> Active Corporate Partners</h5>
                <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 rounded-pill px-3">Monitored Hostings</span>
              </div>
              
              <div className="text-center py-4">
                <div className="display-1 text-success fw-bolder mb-2">{oversight.activeCompanies}</div>
                <p className="text-muted fw-medium">Unique organizations currently hosting or processing students in the system.</p>
              </div>
              <div className="alert bg-soft border-0 text-primary small fw-bold mt-2">
                <i className="bi bi-info-circle-fill me-2"></i> The Faculty maintains continuous oversight of partner company assignments to ensure broad institutional alignment.
              </div>
            </div>
          </div>
        </div>
      )}

      {/* --- DATA REGISTRY TABLE (Archive) --- */}
      {activeTab === 'Archive' && (
        <div className="premium-table table-responsive mb-5 animate-fade">
          <table className="table align-middle mb-0">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>Student Details</th>
                <th style={{ width: '20%' }}>Academic Unit</th>
                <th style={{ width: '25%' }}>Placement Details</th>
                <th className="text-end" style={{ width: '25%' }}>Oversight Record</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan="4" className="text-center py-5">
                    <div className="spinner-border text-primary mb-3" role="status" style={{width: '3rem', height: '3rem'}}></div>
                    <div className="text-muted fw-medium">Syncing Institutional Registry...</div>
                  </td>
                </tr>
              ) : filteredApps.length === 0 ? (
                <tr>
                  <td colSpan="4" className="text-center py-5">
                    <div className="bg-light rounded-circle d-inline-flex align-items-center justify-content-center mb-3" style={{ width: '80px', height: '80px' }}>
                      <i className="bi bi-search text-muted fs-1"></i>
                    </div>
                    <h5 className="text-dark fw-bold">No Records Found</h5>
                    <p className="text-muted small mb-0">
                      No history matches your search criteria.
                    </p>
                  </td>
                </tr>
              ) : (
                filteredApps.map((app) => (
                  <tr key={app.id}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <div className="avatar-initial shadow-sm">
                          {app.studentName?.charAt(0).toUpperCase() || 'S'}
                        </div>
                        <div>
                          <div className="fw-bolder text-dark">{app.studentName}</div>
                          <div className="small text-muted font-monospace fw-medium mt-1">ID: {app.studentId || 'Pending'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="badge bg-soft text-primary border border-primary border-opacity-25 px-3 py-2 rounded-pill fw-bold">
                        {app.department || 'Informatics'}
                      </span>
                    </td>
                    <td>
                      <div className="fw-bold text-dark"><i className="bi bi-building me-2 text-primary"></i>{app.companyName || 'Not Assigned'}</div>
                      <div className="small text-muted text-truncate mt-1" style={{ maxWidth: '200px' }}>Type: {app.placementType === 'self' ? 'Self-Placement' : 'Assigned'}</div>
                    </td>
                    <td className="text-end">
                      <div className="d-flex flex-column align-items-end">
                        <span className={`badge ${app.status === 'FinanceProcessed' ? 'bg-success' : 'bg-secondary'} bg-opacity-10 ${app.status === 'FinanceProcessed' ? 'text-success border-success' : 'text-secondary border-secondary'} border border-opacity-25 rounded-pill px-3 py-2 mb-2`}>
                          {app.status === 'FinanceProcessed' ? <><i className="bi bi-check-circle-fill me-1"></i> Cleared & Processed</> : app.status}
                        </span>
                        {app.submittedAt && (
                          <div className="small text-muted font-monospace" style={{ fontSize: '0.75rem' }}>
                            Created: {new Date(app.submittedAt.seconds * 1000).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

    </Layout>
  );
};

export default FacultyDashboard;