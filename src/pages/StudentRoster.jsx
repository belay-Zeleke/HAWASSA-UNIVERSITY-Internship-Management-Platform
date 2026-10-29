import React, { useState, useEffect, useMemo } from 'react';
import { db } from '../firebase-config';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const StudentRoster = () => {
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");

  const role = localStorage.getItem('role') || 'DepartmentStaff';
  const userName = localStorage.getItem('userName') || 'Dept Admin';
  const staffDept = localStorage.getItem('department') || 'Information Systems';

  // Fetch all students for this specific department
  useEffect(() => {
    if (!staffDept) return;

    const qStudents = query(
      collection(db, "applications"),
      where("department", "==", staffDept)
    );

    const unsubscribe = onSnapshot(qStudents, (snapshot) => {
      const studentData = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      // Sort alphabetically by name
      studentData.sort((a, b) => (a.studentName || '').localeCompare(b.studentName || ''));
      setStudents(studentData);
      setLoading(false);
    }, (error) => {
      console.error("Roster Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [staffDept]);

  // Filtering Logic
  const filteredStudents = useMemo(() => {
    return students.filter(student => {
      const matchesSearch = 
        (student.studentName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (student.studentId?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
        (student.companyName?.toLowerCase() || '').includes(searchTerm.toLowerCase());

      let matchesStatus = true;
      if (statusFilter === 'Pending') {
        matchesStatus = ['PendingDeptApproval', 'Assigned'].includes(student.status);
      } else if (statusFilter === 'Active') {
        matchesStatus = student.status === 'Active';
      } else if (statusFilter === 'Completed') {
        matchesStatus = ['CompanyEvaluated', 'ReportSubmitted', 'PendingAcademicApproval', 'AcademicallyApproved', 'FinanceProcessed', 'Completed'].includes(student.status);
      }

      return matchesSearch && matchesStatus;
    });
  }, [students, searchTerm, statusFilter]);

  // Analytics
  const analytics = useMemo(() => {
    return {
      total: students.length,
      active: students.filter(s => s.status === 'Active').length,
      completed: students.filter(s => ['FinanceProcessed', 'Completed', 'AcademicallyApproved'].includes(s.status)).length
    };
  }, [students]);

  // Status Badge Helper
  const renderStatusBadge = (status) => {
    if (['FinanceProcessed', 'Completed', 'AcademicallyApproved'].includes(status)) {
      return <span className="badge bg-success bg-opacity-10 text-success border border-success border-opacity-25 px-3 py-2 rounded-pill"><i className="bi bi-check-all me-1"></i> Completed</span>;
    }
    if (status === 'Active') {
      return <span className="badge bg-primary bg-opacity-10 text-primary border border-primary border-opacity-25 px-3 py-2 rounded-pill"><i className="bi bi-briefcase me-1"></i> Active in Field</span>;
    }
    if (['Rejected', 'RejectedByCompany'].includes(status)) {
      return <span className="badge bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25 px-3 py-2 rounded-pill"><i className="bi bi-x-circle me-1"></i> Placement Failed</span>;
    }
    return <span className="badge bg-warning bg-opacity-10 text-dark border border-warning border-opacity-50 px-3 py-2 rounded-pill"><i className="bi bi-hourglass-split me-1"></i> Pending / Pipeline</span>;
  };

  return (
    <Layout role={role} userName={userName}>
      <style>{`
        :root { --primary-dept: #0055FF; --bg-soft: #F8FAFC; }
        .dept-header { margin-bottom: 2rem; border-left: 4px solid var(--primary-dept); padding-left: 1.5rem; }
        .stat-card { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 1.5rem; display: flex; align-items: center; gap: 1rem; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: all 0.3s ease; }
        .stat-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .stat-icon { width: 54px; height: 54px; border-radius: 14px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; }
        .controls-bar { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 16px; padding: 16px; margin-bottom: 1.5rem; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 4px 12px rgba(0,0,0,0.02); flex-wrap: wrap; gap: 1rem; }
        .premium-table { background: #ffffff; border-radius: 16px; border: 1px solid #E2E8F0; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.03); }
        .premium-table thead th { background: var(--bg-soft); color: #64748B; font-size: 0.75rem; font-weight: 800; text-transform: uppercase; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1.2rem 1.5rem; }
        .premium-table tbody td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: #1E293B; }
        .premium-table tbody tr:hover { background: var(--bg-soft); }
        .search-input { width: 100%; padding: 10px 16px 10px 42px; border-radius: 10px; border: 1px solid #E2E8F0; background: var(--bg-soft); font-size: 0.95rem; transition: 0.3s; }
        .search-input:focus { background: #ffffff; border-color: #0055FF; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .avatar-initial { width: 42px; height: 42px; border-radius: 50%; background: #EFF6FF; color: #2563EB; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1.1rem; border: 1px solid #BFDBFE; flex-shrink: 0; }
        .animate-fade { animation: slideUpFade 0.4s ease forwards; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      {/* Header */}
      <div className="dept-header d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 no-print">
        <div>
          <span className="badge bg-primary bg-opacity-10 text-primary border border-primary px-3 py-2 rounded-pill fw-bolder text-uppercase mb-2" style={{ letterSpacing: '1px' }}>
            {staffDept} Department
          </span>
          <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Master Student Roster</h2>
          <p className="text-muted mb-0 fw-medium">Complete overview of all registered students in the department.</p>
        </div>
        <button className="btn btn-dark fw-bold shadow-sm rounded-3 px-4 py-2 d-flex align-items-center gap-2" onClick={() => window.print()}>
          <i className="bi bi-printer-fill"></i> Print Roster
        </button>
      </div>

      {/* Metrics */}
      <div className="row g-4 mb-4 no-print">
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-primary bg-opacity-10 text-primary"><i className="bi bi-people-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Total Registered</p>
              <h2 className="fw-bolder mb-0 text-dark">{analytics.total}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-success bg-opacity-10 text-success"><i className="bi bi-briefcase-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Active Placements</p>
              <h2 className="fw-bolder mb-0 text-dark">{analytics.active}</h2>
            </div>
          </div>
        </div>
        <div className="col-md-4">
          <div className="stat-card">
            <div className="stat-icon bg-dark bg-opacity-10 text-dark"><i className="bi bi-mortarboard-fill"></i></div>
            <div>
              <p className="text-muted fw-bold text-uppercase small mb-1" style={{ letterSpacing: '0.5px' }}>Completed Internships</p>
              <h2 className="fw-bolder mb-0 text-dark">{analytics.completed}</h2>
            </div>
          </div>
        </div>
      </div>

      {/* Controls */}
      <div className="controls-bar no-print">
        <div className="d-flex align-items-center gap-3">
          <i className="bi bi-funnel-fill text-primary fs-5"></i>
          <select 
            className="form-select border-light shadow-sm fw-bold text-muted" 
            style={{ width: '200px', borderRadius: '10px' }} 
            value={statusFilter} 
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="All">All Statuses</option>
            <option value="Pending">Pending / Unassigned</option>
            <option value="Active">Active in Field</option>
            <option value="Completed">Completed / Cleared</option>
          </select>
        </div>
        <div className="position-relative" style={{ width: '300px' }}>
          <i className="bi bi-search position-absolute text-muted" style={{ left: '14px', top: '50%', transform: 'translateY(-50%)' }}></i>
          <input 
            type="text" 
            className="search-input" 
            placeholder="Search student or company..." 
            value={searchTerm} 
            onChange={(e) => setSearchTerm(e.target.value)} 
          />
        </div>
      </div>

      {/* Table */}
      <div className="premium-table table-responsive mb-5 animate-fade">
        <table className="table align-middle mb-0">
          <thead>
            <tr>
              <th style={{ width: '30%' }}>Student Identity</th>
              <th style={{ width: '25%' }}>Placement Strategy</th>
              <th style={{ width: '25%' }}>Host Organization</th>
              <th className="text-end" style={{ width: '20%' }}>Current Status</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
            ) : filteredStudents.length === 0 ? (
              <tr>
                <td colSpan="4" className="text-center py-5 text-muted">
                  <i className="bi bi-person-vcard fs-1 d-block mb-3 opacity-50"></i>
                  <h5 className="fw-bolder text-dark">No Students Found</h5>
                  <p className="small mb-0">Adjust your search or filter criteria.</p>
                </td>
              </tr>
            ) : (
              filteredStudents.map((student) => (
                <tr key={student.id}>
                  <td>
                    <div className="d-flex align-items-center gap-3">
                      <div className="avatar-initial shadow-sm">{student.studentName?.charAt(0).toUpperCase() || 'S'}</div>
                      <div>
                        <div className="fw-bolder text-dark">{student.studentName}</div>
                        <div className="small text-muted font-monospace mt-1">ID: {student.studentId || 'N/A'}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${student.placementType === 'self' ? 'bg-primary text-primary' : 'bg-info text-dark'} bg-opacity-10 border px-3 py-1 rounded-pill mb-2`}>
                      {student.placementType === 'self' ? 'Self-Placement' : 'University Assigned'}
                    </span>
                    <div className="small text-muted fw-medium mt-1">
                      <i className="bi bi-diagram-3 me-1 text-primary"></i> {student.requestedWorkingArea || 'General Area'}
                    </div>
                  </td>
                  <td>
                    {student.companyName && student.companyName !== 'Awaiting Assignment' ? (
                      <>
                        <div className="fw-bold text-dark"><i className="bi bi-building me-2 text-primary"></i>{student.companyName}</div>
                        <div className="small text-muted mt-1"><i className="bi bi-geo-alt-fill text-danger me-1"></i> {student.location || 'N/A'}</div>
                      </>
                    ) : (
                      <span className="text-muted fst-italic small">Not assigned yet</span>
                    )}
                  </td>
                  <td className="text-end">
                    {renderStatusBadge(student.status)}
                    {student.companyScore !== undefined && (
                      <div className="small mt-2 font-monospace fw-bold text-dark">
                        Score: <span className={student.companyScore >= 60 ? 'text-success' : 'text-danger'}>{student.companyScore}/100</span>
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

export default StudentRoster;