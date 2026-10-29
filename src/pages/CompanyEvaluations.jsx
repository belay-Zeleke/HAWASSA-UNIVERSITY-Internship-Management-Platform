import React, { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { db, auth } from '../firebase-config';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { onAuthStateChanged } from 'firebase/auth';
import Layout from '../components/Layout';
import 'bootstrap/dist/css/bootstrap.min.css';

const CompanyEvaluations = () => {
  const [evaluations, setEvaluations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedEval, setSelectedEval] = useState(null);
  
  // Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [filterOutcome, setFilterOutcome] = useState('All');
  
  const userName = localStorage.getItem('userName') || 'Representative';
  const role = localStorage.getItem('role') || 'CompanyRepresentative';

  useEffect(() => {
    const fetchEvals = async (user) => {
      try {
        // FIX 1: Pointing to the 'applications' collection where the score is actually saved
        // FIX 2: Matching 'companyId' to the logged-in user's UID
        const q = query(collection(db, "applications"), where("companyId", "==", user.uid));
        const snap = await getDocs(q);
        
        // Filter out applications that haven't been evaluated yet
        const evaluatedDocs = snap.docs.filter(d => d.data().companyScore !== undefined && d.data().companyScore !== null);
        
        const data = evaluatedDocs.map(d => {
          const docData = d.data();
          
          // FIX 3: Pulling from the exact field name used in your Student/Dept dashboards
          const finalScore = Number(docData.companyScore || 0);

          let rec = docData.companyRecommendation;
          if (!rec) {
            if (finalScore >= 85) rec = 'Hiring Ready';
            else if (finalScore >= 60) rec = 'Completed';
            else rec = 'Unsatisfactory';
          }

          return {
            id: d.id,
            ...docData,
            studentName: docData.studentName || 'Archived Intern',
            avgScore: finalScore,
            recommendation: rec,
            feedback: docData.companyReport || 'No written feedback provided.',
            formattedDate: docData.companyEvaluatedAt ? docData.companyEvaluatedAt.toDate().toLocaleDateString('en-US', { day:'numeric', month:'short', year:'numeric' }) : 'Recently'
          };
        });
        
        setEvaluations(data.sort((a,b) => b.avgScore - a.avgScore));
      } catch (err) {
        console.error("Failed to load evaluations:", err);
      } finally {
        setLoading(false);
      }
    };
    
    const unsub = onAuthStateChanged(auth, u => u && fetchEvals(u));
    return () => unsub();
  }, []);

  // Filter Logic
  const filteredEvals = useMemo(() => {
    return evaluations.filter(ev => {
      const matchesSearch = (ev.studentName || '').toLowerCase().includes(searchTerm.toLowerCase());
      const matchesFilter = filterOutcome === 'All' || ev.recommendation === filterOutcome;
      return matchesSearch && matchesFilter;
    });
  }, [evaluations, searchTerm, filterOutcome]);

  return (
    <Layout role={role} userName={userName}>
      {/* --- AESTHETIC CSS INJECTION --- */}
      <style>{`
        :root { --primary-hue: #0055FF; --bg-hue: #F8FAFC; --text-main: #001A33; --text-muted: #64748B; }
        
        /* Typography */
        .text-title { color: var(--text-main); font-weight: 800; letter-spacing: -0.5px; }
        .text-subtitle { color: var(--text-muted); font-weight: 600; font-size: 0.9rem; }
        
        /* Floating Cards */
        .float-card { background: white; border-radius: 20px; padding: 25px; border: 1px solid #E2E8F0; box-shadow: 0 4px 12px rgba(0,0,0,0.02); transition: 0.3s ease; position: relative; overflow: hidden; }
        .float-card:hover { transform: translateY(-4px); box-shadow: 0 12px 24px rgba(0,0,0,0.06); border-color: #CBD5E1; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 24px; margin-bottom: 30px; }
        
        /* Search & Filter Bar */
        .controls-bar { background: white; border-radius: 16px; padding: 12px 20px; margin-bottom: 30px; border: 1px solid #E2E8F0; display: flex; gap: 15px; align-items: center; box-shadow: 0 2px 8px rgba(0,0,0,0.02); flex-wrap: wrap; }
        .aesthetic-input { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 16px 10px 42px; font-size: 0.95rem; flex-grow: 1; outline: none; transition: 0.3s; color: var(--text-main); width: 100%; min-width: 250px; }
        .aesthetic-input:focus { background: white; border-color: var(--primary-hue); box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); }
        .filter-select { background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 10px; padding: 10px 16px; font-weight: 700; color: var(--text-main); outline: none; cursor: pointer; transition: 0.3s; }
        .filter-select:focus { border-color: var(--primary-hue); }
        
        /* Table Styles */
        .aesthetic-table th { background: #F8FAFC; color: var(--text-muted); font-weight: 800; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 1px; border-bottom: 2px solid #E2E8F0; padding: 1rem 1.5rem; }
        .aesthetic-table td { padding: 1.25rem 1.5rem; vertical-align: middle; border-bottom: 1px solid #F1F5F9; color: var(--text-main); transition: 0.2s; }
        .table-row-hover:hover td { background: #F8FAFC; cursor: pointer; }
        
        /* Buttons & Badges */
        .btn-aesthetic { background: var(--primary-hue); color: white; border-radius: 10px; padding: 10px 24px; font-weight: 700; border: none; transition: 0.3s; box-shadow: 0 4px 12px rgba(0, 85, 255, 0.2); }
        .btn-aesthetic:hover { transform: translateY(-2px); box-shadow: 0 8px 16px rgba(0, 85, 255, 0.3); color: white; }
        .btn-soft { background: #F1F5F9; color: var(--text-muted); border-radius: 10px; padding: 10px 24px; font-weight: 700; border: none; transition: 0.2s; }
        .btn-soft:hover { background: #E2E8F0; color: var(--text-main); }
        
        .score-circle { width: 42px; height: 42px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 1rem; border: 2px solid transparent; }
        
        /* Modals */
        .glass-overlay { position: fixed; inset: 0; background: rgba(0, 14, 28, 0.6); backdrop-filter: blur(6px); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 1rem; }
        .glass-modal { background: rgba(255,255,255,0.98); border-radius: 24px; box-shadow: 0 30px 60px rgba(0,0,0,0.3); width: 100%; max-width: 600px; overflow: hidden; animation: slideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid rgba(255,255,255,0.8); }
        @keyframes slideUp { from { opacity: 0; transform: translateY(30px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        
        @media print {
          .no-print { display: none !important; }
          body { background: white; }
          .float-card { box-shadow: none; border: 1px solid #ccc; }
        }
      `}</style>

      <div>
        {/* --- HEADER --- */}
        <header className="mb-5 d-flex flex-column flex-md-row justify-content-between align-items-md-end gap-3 no-print">
          <div>
            <h2 className="text-title m-0 fs-2">Talent Archives</h2>
            <p className="text-subtitle m-0 mt-1">Analyze historical intern performance and potential hires.</p>
          </div>
          <button className="btn-aesthetic d-flex align-items-center gap-2" onClick={() => window.print()}>
            <i className="bi bi-printer-fill fs-5"></i> Export Report
          </button>
        </header>

        {/* --- KPI METRICS --- */}
        <div className="stats-grid no-print">
          <div className="float-card d-flex align-items-center gap-4">
            <div className="rounded-4 d-flex align-items-center justify-content-center text-primary fs-3 bg-primary bg-opacity-10" style={{width: 64, height: 64}}>
              <i className="bi bi-folder-check"></i>
            </div>
            <div>
              <p className="text-subtitle fw-bold text-uppercase mb-1" style={{fontSize: '0.75rem'}}>Total Evaluated</p>
              <h2 className="text-title m-0">{evaluations.length}</h2>
            </div>
          </div>
          
          <div className="float-card d-flex align-items-center gap-4">
            <div className="rounded-4 d-flex align-items-center justify-content-center text-warning fs-3 bg-warning bg-opacity-10" style={{width: 64, height: 64}}>
              <i className="bi bi-graph-up-arrow"></i>
            </div>
            <div>
              <p className="text-subtitle fw-bold text-uppercase mb-1" style={{fontSize: '0.75rem'}}>Cohort Avg. Score</p>
              <h2 className="text-title m-0">
                {evaluations.length > 0 ? Math.round(evaluations.reduce((s, e) => s + e.avgScore, 0) / evaluations.length) : 0}<span className="fs-5 text-muted ms-1">/100</span>
              </h2>
            </div>
          </div>

          <div className="float-card d-flex align-items-center gap-4">
            <div className="rounded-4 d-flex align-items-center justify-content-center text-success fs-3 bg-success bg-opacity-10" style={{width: 64, height: 64}}>
              <i className="bi bi-briefcase-fill"></i>
            </div>
            <div>
              <p className="text-subtitle fw-bold text-uppercase mb-1" style={{fontSize: '0.75rem'}}>Hiring Pipeline Ready</p>
              <h2 className="text-title m-0 text-success">
                {evaluations.filter(e => e.recommendation === 'Hiring Ready').length}
              </h2>
            </div>
          </div>
        </div>

        {/* --- SEARCH & FILTER BAR --- */}
        <div className="controls-bar no-print">
          <div className="d-flex align-items-center flex-grow-1 position-relative">
            <i className="bi bi-search position-absolute ms-3 text-muted"></i>
            <input 
              type="text" 
              className="aesthetic-input" 
              placeholder="Search past interns by name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="d-flex align-items-center gap-2">
            <i className="bi bi-funnel-fill text-primary d-none d-sm-block"></i>
            <select 
              className="filter-select" 
              value={filterOutcome} 
              onChange={(e) => setFilterOutcome(e.target.value)}
            >
              <option value="All">All Outcomes</option>
              <option value="Hiring Ready">Top Performers (Hiring Ready)</option>
              <option value="Completed">Standard Completion</option>
              <option value="Unsatisfactory">Needs Improvement</option>
            </select>
          </div>
        </div>

        {/* --- DATA TABLE --- */}
        <div className="float-card p-0">
          <div className="table-responsive">
            <table className="table aesthetic-table m-0">
              <thead>
                <tr>
                  <th style={{width: '35%'}}>Intern Identity</th>
                  <th style={{width: '25%'}}>HR Assessment</th>
                  <th className="text-center" style={{width: '20%'}}>Performance Score</th>
                  <th className="text-end" style={{width: '20%'}}>Review Date</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr><td colSpan="4" className="text-center py-5"><div className="spinner-border text-primary"></div></td></tr>
                ) : filteredEvals.length === 0 ? (
                  <tr>
                    <td colSpan="4" className="text-center py-5 text-muted">
                      <i className="bi bi-inbox fs-1 d-block mb-3 opacity-50"></i>
                      <h6 className="fw-bold text-dark">No records found</h6>
                      <p className="small mb-0">Try adjusting your search or filter settings.</p>
                    </td>
                  </tr>
                ) : filteredEvals.map(ev => (
                  <tr key={ev.id} className="table-row-hover" onClick={() => setSelectedEval(ev)}>
                    <td>
                      <div className="d-flex align-items-center gap-3">
                        <div className="rounded-circle d-flex align-items-center justify-content-center text-primary fw-bolder bg-primary bg-opacity-10 border border-primary border-opacity-25" style={{width: 40, height: 40, flexShrink: 0}}>
                          {ev.studentName?.charAt(0).toUpperCase() || 'U'}
                        </div>
                        <div>
                          <div className="fw-bold text-main">{ev.studentName}</div>
                          <div className="text-muted font-monospace" style={{fontSize: '0.7rem'}}>ID: {ev.studentId || 'N/A'}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`badge rounded-pill px-3 py-2 ${
                        ev.recommendation === 'Hiring Ready' ? 'bg-success bg-opacity-10 text-success border border-success border-opacity-25' : 
                        ev.recommendation === 'Unsatisfactory' ? 'bg-danger bg-opacity-10 text-danger border border-danger border-opacity-25' : 
                        'bg-secondary bg-opacity-10 text-secondary border border-secondary border-opacity-25'
                      }`}>
                        {ev.recommendation}
                      </span>
                    </td>
                    <td>
                      <div className="d-flex justify-content-center">
                        <div className="score-circle" style={{
                          background: ev.avgScore >= 85 ? '#F0FDF4' : ev.avgScore >= 60 ? '#EFF6FF' : '#FEF2F2', 
                          color: ev.avgScore >= 85 ? '#15803D' : ev.avgScore >= 60 ? 'var(--primary-hue)' : '#DC2626',
                          borderColor: ev.avgScore >= 85 ? '#BBF7D0' : ev.avgScore >= 60 ? '#BFDBFE' : '#FECACA'
                        }}>
                          {ev.avgScore}
                        </div>
                      </div>
                    </td>
                    <td className="text-end text-subtitle fw-medium">{ev.formattedDate}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* --- DETAILED EXIT INTERVIEW MODAL --- */}
      {selectedEval && createPortal(
        <div className="glass-overlay" onClick={() => setSelectedEval(null)}>
           <div className="glass-modal" onClick={e => e.stopPropagation()}>
             
             {/* Header */}
             <div className="p-4" style={{background: 'linear-gradient(135deg, #001A33 0%, #000E1C 100%)', color: 'white'}}>
               <div className="d-flex justify-content-between align-items-center">
                 <div>
                   <span className="badge bg-white bg-opacity-20 text-white rounded-pill px-3 py-2 border border-white border-opacity-25 mb-2">
                     <i className="bi bi-file-earmark-text-fill me-1"></i> Official Exit Transcript
                   </span>
                   <h3 className="fw-bolder m-0">{selectedEval.studentName}</h3>
                 </div>
                 <div className="rounded-circle d-flex align-items-center justify-content-center fw-black shadow" style={{width: 70, height: 70, fontSize: '1.5rem', background: '#FFCC00', color: '#001A33'}}>
                   {selectedEval.avgScore}
                 </div>
               </div>
             </div>
             
             {/* Body */}
             <div className="p-4 p-md-5 bg-white">
               <div className="row g-4 mb-4 pb-4 border-bottom">
                 <div className="col-6">
                   <div className="text-muted fw-bold text-uppercase mb-1" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>HR Recommendation</div>
                   <div className={`fw-black fs-5 ${selectedEval.recommendation === 'Hiring Ready' ? 'text-success' : 'text-main'}`}>
                     {selectedEval.recommendation}
                   </div>
                 </div>
                 <div className="col-6 text-end">
                   <div className="text-muted fw-bold text-uppercase mb-1" style={{fontSize: '0.7rem', letterSpacing: '1px'}}>Recorded On</div>
                   <div className="fw-bold text-main fs-5">{selectedEval.formattedDate}</div>
                 </div>
               </div>

               <div className="mb-4">
                 <label className="text-main fw-bold text-uppercase mb-2" style={{fontSize: '0.75rem', letterSpacing: '1px'}}>Supervisor's Executive Summary</label>
                 <div className="p-4 rounded-4 border" style={{background: '#F8FAFC', lineHeight: '1.7', color: '#334155'}}>
                   <em>"{selectedEval.feedback || 'No written feedback provided.'}"</em>
                 </div>
               </div>

               <div className="d-flex justify-content-between align-items-center pt-3 mt-4 border-top">
                 <button className="btn-soft" onClick={() => setSelectedEval(null)}>Close Record</button>
                 <div className="d-flex gap-2">
                   <button className="btn-aesthetic d-flex align-items-center gap-2" style={{background: '#001A33'}}>
                     <i className="bi bi-printer-fill"></i> Print
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

export default CompanyEvaluations;