import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { db } from '../firebase-config';
import { collection, query, where, getDocs, getDoc, doc, setDoc, updateDoc, serverTimestamp, onSnapshot } from 'firebase/firestore';
import Layout from '../components/Layout';
import { jsPDF } from "jspdf"; 
import 'bootstrap/dist/css/bootstrap.min.css';

const ETHIOPIAN_CITIES = [
  "Addis Ababa", "Adama", "Arba Minch", "Asella", "Bahir Dar", 
  "Bishoftu", "Debre Markos", "Dessie", "Dila", "Dire Dawa", 
  "Gondar", "Hawassa", "Hosaena", "Jimma", "Mekelle", 
  "Nekemte", "Shashamane", "Wolaita Sodo", "Other"
];

const getMockCompanies = (city) => {
  if (!city || city === 'Other') return [];
  const prefixes = ["NextGen", "EthioSoft", "Pioneer", "Apex", "BlueSky", "Quantum", "Vertex", "Horizon", "Nimbus", "Alpha"];
  const suffixes = ["Technologies", "Systems", "Networks", "Solutions", "Innovations", "IT Services", "Digital", "Software", "Computing", "Labs"];
  return prefixes.map((prefix, index) => ({
    id: `mock-${city}-${index}`, companyName: `${prefix} ${city} ${suffixes[index]}`,
    email: `hr@${prefix.toLowerCase()}${city.toLowerCase().replace(/\s+/g, '')}.com`, location: city, accountStatus: 'Active'
  }));
};

const StudentDashboard = () => {
 // eslint-disable-next-line
  const navigate = useNavigate();
  const [application, setApplication] = useState(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [notification, setNotification] = useState({ type: '', message: '' });
  const [partnerCompanies, setPartnerCompanies] = useState([]);

  const userId = localStorage.getItem('userId');
  const userName = localStorage.getItem('userName') || 'Student';
  const role = localStorage.getItem('role') || 'Student';
  const studentDept = localStorage.getItem('department') || '';
  const loggedInStudentId = localStorage.getItem('studentId') || ''; 

  const [regForm, setRegForm] = useState({ 
    studentId: loggedInStudentId, department: studentDept, bankAccount: '',
    placementType: 'university', companyName: '', location: '', preferredArea: ''
  });
  
  const [isManualCompany, setIsManualCompany] = useState(false);
  const [reportFile, setReportFile] = useState(null); 

  useEffect(() => {
    if (!userId) { setLoading(false); return; }

    const fetchUserProfile = async () => {
      try {
        const userDoc = await getDoc(doc(db, "users", userId));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          setRegForm(prev => ({
            ...prev, studentId: userData.studentId || prev.studentId, department: userData.department || prev.department
          }));
        }
      } catch (err) { console.error("Failed to fetch user profile", err); }
    };
    fetchUserProfile();

    const qApp = query(collection(db, "applications"), where("userId", "==", userId));
    const unsubscribe = onSnapshot(qApp, async (appSnapshot) => {
      if (!appSnapshot.empty) {
        const appData = { id: appSnapshot.docs[0].id, ...appSnapshot.docs[0].data() };
        setApplication(appData);
      }
      setLoading(false);
    });

    const fetchPartners = async () => {
      try {
        const qComps = query(collection(db, "users"), where("role", "==", "CompanyRepresentative"));
        const compSnap = await getDocs(qComps);
        setPartnerCompanies(compSnap.docs.map(d => d.data()));
      } catch (err) {}
    };
    fetchPartners();
    
    return () => unsubscribe();
  }, [userId]);

  const suggestedCompanies = useMemo(() => {
    if (!regForm.location) return [];
    const realComps = partnerCompanies.filter(c => c.location === regForm.location && c.accountStatus !== 'Inactive');
    return [...realComps, ...getMockCompanies(regForm.location)];
  }, [regForm.location, partnerCompanies]);

  const handleRegistrationSubmit = async (e) => {
    e.preventDefault();
    if (regForm.studentId.length !== 7) { 
      setNotification({ type: 'warning', message: 'University ID must be exactly 0000/00.' }); 
      return; 
    }

    // ==========================================
    // CBE BANK ACCOUNT VALIDATION (13 Digits)
    // ==========================================
    const cbeRegex = /^\d{13}$/;
    if (!cbeRegex.test(regForm.bankAccount)) {
      setNotification({ type: 'warning', message: 'Invalid Bank Account. Commercial Bank of Ethiopia (CBE) accounts must be exactly 13 digits.' });
      return;
    }
    // ==========================================

    if (regForm.placementType === 'self' && !regForm.companyName) { 
      setNotification({ type: 'warning', message: 'Select or enter a company.' }); 
      return; 
    }

    setProcessing(true);
    try {
      const newAppRef = doc(collection(db, "applications"));
      const newApp = {
        userId: userId, studentName: userName, studentId: regForm.studentId, 
        department: regForm.department, bankAccount: regForm.bankAccount, placementType: regForm.placementType,
        status: 'PendingDeptApproval', companyName: regForm.placementType === 'self' ? regForm.companyName : 'Awaiting Assignment',
        location: regForm.placementType === 'self' ? regForm.location : '', requestedWorkingArea: regForm.preferredArea, submittedAt: serverTimestamp()
      };
      await setDoc(newAppRef, newApp);
      setApplication({ id: newAppRef.id, ...newApp });
      setNotification({ type: 'success', message: 'Registration submitted successfully!' });
    } catch (error) { setNotification({ type: 'danger', message: 'Failed to submit form.' }); } 
    finally { setProcessing(false); }
  };

  const handleReportSubmit = async (e) => {
    e.preventDefault();
    if (!reportFile) return;
    if (reportFile.size > 1048487) { setNotification({ type: 'danger', message: 'File too large! Max size is 1MB.' }); return; }

    setProcessing(true);
    setNotification({ type: 'info', message: 'Sending document to the Department...' });

    try {
      const reader = new FileReader();
      reader.readAsDataURL(reportFile);
      reader.onload = async () => {
        const base64Pdf = reader.result;
        const newStatus = 'ReportSubmitted'; 
        await updateDoc(doc(db, "applications", application.id), { status: newStatus, reportUrl: base64Pdf, reportSubmittedAt: serverTimestamp() });
        setApplication({ ...application, status: newStatus, reportUrl: base64Pdf });
        setNotification({ type: 'success', message: 'Report submitted successfully!' });
        setProcessing(false);
      };
      reader.onerror = () => { throw new Error("Failed to read file"); };
    } catch (error) { setNotification({ type: 'danger', message: `Upload failed: ${error.message}` }); setProcessing(false); }
  };

  const generateCertificate = () => {
    const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
    doc.setLineWidth(2); doc.setDrawColor(0, 26, 51); doc.rect(10, 10, 277, 190);
    doc.setLineWidth(0.5); doc.setDrawColor(255, 204, 0); doc.rect(12, 12, 273, 186);
    doc.setFont("helvetica", "bold"); doc.setFontSize(28); doc.setTextColor(0, 26, 51);
    doc.text("HAWASSA UNIVERSITY", 148.5, 45, { align: "center" });
    doc.setFontSize(16); doc.setTextColor(100, 100, 100);
    doc.text("FACULTY OF INFORMATICS", 148.5, 55, { align: "center" });
    doc.setFontSize(36); doc.setTextColor(0, 0, 0);
    doc.text("Official Clearance Certificate", 148.5, 85, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(16);
    doc.text("This is to officially certify that", 148.5, 105, { align: "center" });
    doc.setFont("helvetica", "bolditalic"); doc.setFontSize(32); doc.setTextColor(0, 26, 51);
    doc.text(application.studentName || userName, 148.5, 125, { align: "center" });
    doc.setFont("helvetica", "normal"); doc.setFontSize(14); doc.setTextColor(0, 0, 0);
    doc.text(`University ID: ${application.studentId}`, 148.5, 138, { align: "center" });
    const text = `Has successfully completed the mandatory industrial placement requirements\nfor the ${application.department} program at ${application.companyName}.`;
    doc.text(text, 148.5, 153, { align: "center", lineHeightFactor: 1.5 });
    doc.setFont("helvetica", "bold"); doc.setFontSize(14); doc.setTextColor(0, 85, 255);
    doc.text(`Final Department Grade: ${application.finalDeptGrade || 0}/100`, 148.5, 168, { align: "center" });
    doc.setFont("helvetica", "bold"); doc.setFontSize(12); doc.setTextColor(0, 0, 0);
    doc.text("__________________________", 60, 180, { align: "center" });
    doc.text("Deputy Director of Academic Affairs", 60, 187, { align: "center" });
    doc.text("__________________________", 237, 180, { align: "center" });
    doc.text("Finance Office", 237, 187, { align: "center" });
    doc.save(`${(application.studentName || userName).replace(/\s+/g, '_')}_Clearance_Certificate.pdf`);
  };

  const getPipelineStage = () => {
    if (!application) return 0;
    const s = application.status;
    if (s === 'PendingDeptApproval') return 1;
    if (['Assigned', 'Rejected', 'RejectedByCompany'].includes(s)) return 2;
    if (s === 'Active') return 3;
    if (['CompanyEvaluated', 'ReportSubmitted'].includes(s)) return 4;
    if (['PendingAcademicApproval', 'AcademicallyApproved'].includes(s)) return 5;
    if (['FinanceProcessed', 'Completed'].includes(s)) return 6;
    return 1;
  };
  const currentStage = getPipelineStage();

  const handleCityChange = (e) => { setRegForm({...regForm, location: e.target.value, companyName: ''}); setIsManualCompany(false); };

  const handleViewPdf = async (url) => {
    if (!url) { setNotification({ type: 'danger', message: 'No document found.' }); return; }
    try {
      if (url.startsWith('data:application/pdf')) {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl; link.target = '_blank';
        document.body.appendChild(link); link.click(); document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
        return;
      }
      let finalUrl = url;
      if (!finalUrl.startsWith('http')) finalUrl = `https://${finalUrl}`;
      window.open(finalUrl, '_blank');
    } catch (err) { alert("Failed to load PDF."); }
  };

  if (loading) return <Layout role={role} userName={userName}><div className="text-center py-5"><div className="spinner-border text-primary" style={{width: '3rem', height: '3rem'}}></div></div></Layout>;

  return (
    <Layout role={role} userName={userName}>
      <style>{`
        .journey-header { margin-bottom: 2rem; }
        .glass-panel { background: #ffffff; border: 1px solid #E2E8F0; border-radius: 20px; padding: 2.5rem; box-shadow: 0 10px 30px rgba(0,0,0,0.03); margin-bottom: 2rem; }
        .path-card { border: 2px solid #E2E8F0; border-radius: 16px; padding: 1.5rem; cursor: pointer; transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1); background: #F8FAFC; text-align: center; height: 100%; display: flex; flex-direction: column; justify-content: center; }
        .path-card:hover { border-color: #CBD5E1; transform: translateY(-2px); }
        .path-card.active { border-color: #0055FF; background: #EFF6FF; box-shadow: 0 8px 20px rgba(0, 85, 255, 0.1); }
        .company-card { transition: 0.2s; border: 2px solid transparent; }
        .company-card:hover { background-color: #F8FAFC; border-color: #E2E8F0; }
        .company-card.selected { border-color: #0055FF; background-color: #EFF6FF; }
        .pipeline-container { display: flex; justify-content: space-between; position: relative; padding: 0 1rem; margin-bottom: 3rem; }
        .pipeline-bg-track { position: absolute; top: 50%; left: 1rem; right: 1rem; height: 4px; background: #E2E8F0; transform: translateY(-50%); z-index: 0; border-radius: 4px; }
        .pipeline-progress { position: absolute; top: 50%; left: 1rem; height: 4px; transform: translateY(-50%); z-index: 1; transition: width 0.6s cubic-bezier(0.16, 1, 0.3, 1), background-color 0.3s ease; border-radius: 4px; }
        .pipeline-step { position: relative; z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 0.5rem; }
        .step-circle { width: 44px; height: 44px; border-radius: 50%; background: #ffffff; border: 4px solid #E2E8F0; display: flex; align-items: center; justify-content: center; font-weight: 800; color: #94A3B8; transition: all 0.3s ease; box-shadow: 0 0 0 6px #ffffff; font-size: 1.1rem; }
        .step-label { font-size: 0.75rem; font-weight: 800; color: #64748B; text-transform: uppercase; letter-spacing: 0.5px; text-align: center; width: 95px; }
        .pipeline-step.active .step-circle { border-color: #0055FF; color: #0055FF; background: #EFF6FF; transform: scale(1.1); }
        .pipeline-step.active .step-label { color: #001A33; }
        .pipeline-step.completed .step-circle { border-color: #10B981; background: #10B981; color: white; }
        .floating-group { position: relative; margin-bottom: 1.5rem; }
        .floating-input { width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; border-radius: 12px; background: #F8FAFC; font-size: 0.95rem; color: #1E293B; transition: 0.2s; }
        .floating-input:focus { border-color: #0055FF; background: #ffffff; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .floating-label { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.95rem; pointer-events: none; transition: 0.2s; font-weight: 500; }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; font-size: 0.7rem; color: #0055FF; font-weight: 700; letter-spacing: 0.5px; }
        .btn-premium { background: linear-gradient(135deg, #001A33 0%, #000E1C 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 16px 24px; font-size: 1rem; letter-spacing: 0.5px; transition: 0.3s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; }
        .btn-premium:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 26, 51, 0.3); color: white; }
        .animate-fade-in { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        .file-upload-wrapper { border: 2px dashed #CBD5E1; border-radius: 12px; padding: 2rem; text-align: center; background: #F8FAFC; transition: 0.3s; cursor: pointer; position: relative;}
        .file-upload-wrapper:hover { border-color: #0055FF; background: #EFF6FF; }
        .file-upload-input { opacity: 0; position: absolute; top: 0; left: 0; width: 100%; height: 100%; cursor: pointer; }
      `}</style>

      <div className="journey-header">
        <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Internship Hub</h2>
        <p className="text-muted mb-0 fw-medium">Faculty of Informatics Official Placement & Monitoring System</p>
      </div>

      {notification.message && (
        <div className={`alert alert-${notification.type} d-flex align-items-center rounded-4 shadow-sm mb-4 border-0 animate-fade-in`}>
          <i className={`bi ${notification.type === 'success' ? 'bi-check-circle-fill text-success' : 'bi-exclamation-triangle-fill text-warning'} fs-4 me-3`}></i>
          <span className="fw-bold">{notification.message}</span>
        </div>
      )}

      {!application ? (
        
        <div className="glass-panel animate-fade-in" style={{ maxWidth: '800px', margin: '0 auto' }}>
          <div className="text-center mb-5">
            <h3 className="fw-bolder text-dark">Internship Registration</h3>
            <p className="text-muted fw-medium">Select your placement strategy to configure your profile.</p>
          </div>

          <div className="row g-4 mb-5">
            <div className="col-sm-6">
              <div className={`path-card ${regForm.placementType === 'university' ? 'active' : ''}`} onClick={() => {setRegForm({...regForm, placementType: 'university', location: '', companyName: '', preferredArea: ''}); setIsManualCompany(false);}}>
                <div className="mb-3"><i className={`bi bi-building-check fs-1 ${regForm.placementType === 'university' ? 'text-primary' : 'text-muted'}`}></i></div>
                <h5 className="fw-bolder text-dark mb-2">University Assigned</h5>
                <p className="small text-muted mb-0">The Informatics Department will match you with a verified corporate partner.</p>
              </div>
            </div>
            <div className="col-sm-6">
              <div className={`path-card ${regForm.placementType === 'self' ? 'active' : ''}`} onClick={() => setRegForm({...regForm, placementType: 'self'})}>
                <div className="mb-3"><i className={`bi bi-person-badge fs-1 ${regForm.placementType === 'self' ? 'text-primary' : 'text-muted'}`}></i></div>
                <h5 className="fw-bolder text-dark mb-2">Self-Placement</h5>
                <p className="small text-muted mb-0">You have independently secured an internship and require faculty verification.</p>
              </div>
            </div>
          </div>

          <form onSubmit={handleRegistrationSubmit}>
            <div className="row g-3">
              <div className="col-md-6">
                <div className="floating-group">
                  <input type="text" className="floating-input fw-bolder bg-light text-muted" placeholder=" " value={regForm.studentId} readOnly required />
                  <label className="floating-label">University ID (Locked)</label>
                </div>
              </div>
              <div className="col-md-6">
                <div className="floating-group">
                  <select className="floating-input fw-bolder bg-light text-muted" style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'not-allowed' }} value={regForm.department} disabled required>
                    <option value="" disabled>Select Dept...</option>
                    <option value="Information Systems">Information Systems</option>
                    <option value="Information Technology">Information Technology</option>
                    <option value="Computer Science">Computer Science</option>
                  </select>
                  <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Academic Unit (Locked)</label>
                  <i className="bi bi-lock-fill position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                </div>
              </div>
            </div>
            
            <div className="floating-group mb-4">
              <input 
                type="text" 
                className="floating-input" 
                placeholder=" " 
                value={regForm.bankAccount} 
                onChange={(e) => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= 13) {
                    setRegForm({...regForm, bankAccount: val});
                  }
                }} 
                required 
              />
              <label className="floating-label">CBE Bank Account Number (13 Digits)</label>
            </div>

            <div className="floating-group mb-4 animate-fade-in">
              <select className="floating-input bg-white fw-bold" style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'pointer' }} value={regForm.preferredArea} onChange={(e) => setRegForm({...regForm, preferredArea: e.target.value})} required>
                <option value="" disabled>Select Tech Domain...</option>
                <option value="Software Engineering">Software Engineering</option>
                <option value="Web Development">Web Development</option>
                <option value="Mobile App Development">Mobile App Development</option>
                <option value="Network Administration">Network Administration</option>
                <option value="Database Administration">Database Administration</option>
                <option value="Cybersecurity">Cybersecurity</option>
                <option value="System Administration">System Administration</option>
                <option value="Data Analytics">Data Analytics</option>
                <option value="UI/UX Design">UI/UX Design</option>
                <option value="Quality Assurance (QA)">Quality Assurance (QA)</option>
                <option value="IT Support / Helpdesk">IT Support / Helpdesk</option>
              </select>
              <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Requested Working Area</label>
              <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
            </div>

            {regForm.placementType === 'self' && (
              <div className="p-4 border rounded-4 mb-4 animate-fade-in" style={{ background: '#FAFAFA', borderColor: '#E2E8F0' }}>
                <p className="fw-bolder small text-primary text-uppercase mb-3" style={{ letterSpacing: '1px' }}><i className="bi bi-geo-alt-fill me-2"></i>Location & Corporate Host</p>
                <div className="floating-group mb-3">
                  <select className="floating-input bg-white fw-bold" style={{ appearance: 'none', paddingTop: '1.6rem', paddingBottom: '0.4rem', cursor: 'pointer' }} value={regForm.location} onChange={handleCityChange} required>
                    <option value="" disabled>Select an Ethiopian City...</option>
                    {ETHIOPIAN_CITIES.map(city => <option key={city} value={city}>{city}</option>)}
                  </select>
                  <label className="floating-label" style={{ top: '0.8rem', fontSize: '0.7rem', color: '#0055FF' }}>Placement City</label>
                  <i className="bi bi-chevron-down position-absolute" style={{ right: '16px', top: '50%', transform: 'translateY(-50%)', color: '#64748B' }}></i>
                </div>

                {regForm.location && !isManualCompany && suggestedCompanies.length > 0 && (
                  <div className="mt-3 animate-fade-in">
                    <label className="form-label fw-bold text-dark small mb-2">Available Partners in {regForm.location}</label>
                    <div className="d-flex flex-column gap-2 mb-3" style={{ maxHeight: '280px', overflowY: 'auto', paddingRight: '8px' }}>
                      {suggestedCompanies.map((comp, idx) => (
                        <div key={comp.id || idx} className={`p-3 rounded-3 company-card cursor-pointer ${regForm.companyName === comp.companyName ? 'selected' : 'bg-white'}`} onClick={() => setRegForm({...regForm, companyName: comp.companyName})}>
                          <div className="d-flex justify-content-between align-items-start">
                            <div className="fw-bold text-dark mb-1">{comp.companyName}</div>
                            {regForm.companyName === comp.companyName && <i className="bi bi-check-circle-fill text-primary fs-5"></i>}
                          </div>
                          <div className="small text-muted mb-2 lh-sm">{comp.email || 'Corporate Partner'}</div>
                        </div>
                      ))}
                    </div>
                    <div className="text-center mt-2 border-top pt-3">
                      <p className="small text-muted mb-2">Accepted somewhere else?</p>
                      <button type="button" className="btn btn-outline-secondary btn-sm fw-bold rounded-pill px-4" onClick={() => {setIsManualCompany(true); setRegForm({...regForm, companyName: ''});}}>Enter Company Manually</button>
                    </div>
                  </div>
                )}
                {regForm.location && (isManualCompany || suggestedCompanies.length === 0) && (
                  <div className="mt-4 animate-fade-in border-top pt-4">
                    {suggestedCompanies.length === 0 && (
                       <div className="alert alert-info py-2 small fw-medium border-0"><i className="bi bi-info-circle-fill me-2"></i>No registered partners found in this city. Please enter details manually.</div>
                    )}
                    <div className="floating-group mb-2">
                      <input type="text" className="floating-input bg-white" placeholder=" " value={regForm.companyName} onChange={(e) => setRegForm({...regForm, companyName: e.target.value})} required />
                      <label className="floating-label">Enter Organization Name</label>
                    </div>
                    {suggestedCompanies.length > 0 && (
                      <div className="text-end">
                        <button type="button" className="btn btn-link small fw-bold text-decoration-none text-muted p-0" onClick={() => {setIsManualCompany(false); setRegForm({...regForm, companyName: ''});}}>
                          <i className="bi bi-arrow-left"></i> Back to suggested partners
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
            <button type="submit" className="btn-premium" disabled={processing || !regForm.preferredArea || (regForm.placementType === 'self' && !regForm.companyName) || regForm.bankAccount.length !== 13}>
              {processing ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-send-fill"></i> Transmit Official Registration</>}
            </button>
          </form>
        </div>

      ) : (

        <div className="animate-fade-in">
          
          <div className="glass-panel p-4 p-md-5">
            <div className="pipeline-container">
              <div className="pipeline-bg-track"></div>
              <div className="pipeline-progress" style={{ width: `calc(${Math.max(0, (currentStage - 1) * 20)}% - 0.5rem)`, background: ['Rejected', 'RejectedByCompany'].includes(application.status) ? '#EF4444' : '#0055FF' }}></div>
              
              <div className={`pipeline-step ${currentStage > 1 ? 'completed' : currentStage === 1 ? 'active' : ''}`}>
                <div className="step-circle">{currentStage > 1 ? <i className="bi bi-check-lg"></i> : '1'}</div>
                <div className="step-label">Registered</div>
              </div>
              <div className={`pipeline-step ${currentStage > 2 ? 'completed' : currentStage === 2 ? 'active' : ''}`}>
                <div className="step-circle" style={['Rejected', 'RejectedByCompany'].includes(application.status) ? {borderColor: '#EF4444', color: '#EF4444', background: '#FEF2F2'} : {}}>
                  {currentStage > 2 ? <i className="bi bi-check-lg"></i> : (['Rejected', 'RejectedByCompany'].includes(application.status) ? <i className="bi bi-x-lg"></i> : '2')}
                </div>
                <div className="step-label">{['Rejected', 'RejectedByCompany'].includes(application.status) ? 'Declined' : 'Assigned'}</div>
              </div>
              <div className={`pipeline-step ${currentStage > 3 ? 'completed' : currentStage === 3 ? 'active' : ''}`}>
                <div className="step-circle">{currentStage > 3 ? <i className="bi bi-check-lg"></i> : '3'}</div>
                <div className="step-label">Active Intern</div>
              </div>
              <div className={`pipeline-step ${currentStage > 4 ? 'completed' : currentStage === 4 ? 'active' : ''}`}>
                <div className="step-circle">{currentStage > 4 ? <i className="bi bi-check-lg"></i> : '4'}</div>
                <div className="step-label">Deliverables</div>
              </div>
              <div className={`pipeline-step ${currentStage > 5 ? 'completed' : currentStage === 5 ? 'active' : ''}`}>
                <div className="step-circle">{currentStage > 5 ? <i className="bi bi-check-lg"></i> : '5'}</div>
                <div className="step-label">Academic Approval</div>
              </div>
              <div className={`pipeline-step ${currentStage === 6 ? 'completed' : ''}`}>
                <div className="step-circle">{currentStage === 6 ? <i className="bi bi-check-lg"></i> : '6'}</div>
                <div className="step-label">Finance Cleared</div>
              </div>
            </div>
          </div>

          <div className="row g-4">
            <div className="col-lg-6">
              <div className="glass-panel mb-4">
                <div className="d-flex justify-content-between align-items-start mb-4">
                  <h5 className="fw-bolder mb-0"><i className="bi bi-building-fill text-primary me-2"></i> Corporate Linkage</h5>
                  <span className="badge bg-light text-dark border px-3 py-2 rounded-pill fw-bold">
                    {application.placementType === 'self' ? 'Self-Placement' : 'University Assigned'}
                  </span>
                </div>
                
                {application.status === 'PendingDeptApproval' ? (
                  <div className="text-center py-5 text-muted border rounded-4 bg-light">
                    <i className="bi bi-hourglass-split fs-1 d-block mb-3 opacity-50"></i>
                    <h6 className="fw-bolder text-dark">Awaiting Dept Verification</h6>
                    <p className="small mb-0 px-3">The Department is reviewing your {application.placementType === 'self' ? 'self-placement request' : 'application'}.</p>
                    {application.requestedWorkingArea && (
                      <div className="mt-3"><span className="badge bg-secondary rounded-pill px-3 py-2">Requested Area: {application.requestedWorkingArea}</span></div>
                    )}
                  </div>
                ) : application.status === 'Assigned' ? (
                  <div className="text-center py-5 text-info border border-info border-opacity-25 rounded-4 bg-info bg-opacity-10">
                    <i className="bi bi-shield-check fs-1 d-block mb-3"></i>
                    <h6 className="fw-bolder text-dark">Awaiting Company Acceptance</h6>
                    <p className="small mb-0 px-3 text-dark">Your file has been forwarded to <strong>{application.companyName}</strong> for final acceptance.</p>
                  </div>
                ) : ['Rejected', 'RejectedByCompany'].includes(application.status) ? (
                  <div className="text-center py-5 text-danger border border-danger border-opacity-25 rounded-4 bg-danger bg-opacity-10">
                    <i className="bi bi-x-circle-fill fs-1 d-block mb-3 opacity-75"></i>
                    <h6 className="fw-bolder text-dark">Placement Declined</h6>
                    <p className="small mb-0 px-3 text-dark">Your placement request was rejected. Please contact the Department for reassignment.</p>
                  </div>
                ) : (
                  <div>
                    <div className="mb-0 p-4 bg-light rounded-4 border">
                      <p className="text-muted small fw-bold text-uppercase mb-1" style={{ letterSpacing: '1px' }}>Host Organization</p>
                      <h4 className="fw-bolder text-dark mb-0">{application.companyName}</h4>
                      <div className="mt-3"><span className="badge bg-success rounded-pill px-3 py-2 fw-bold">Placement Confirmed & Active</span></div>
                    </div>
                  </div>
                )}
              </div>

              {currentStage >= 3 && (
                <div className="glass-panel mb-4">
                  <h5 className="fw-bolder mb-4"><i className="bi bi-cloud-arrow-up-fill text-success me-2"></i> Final Deliverable Upload</h5>
                  
                  {['ReportSubmitted', 'PendingAcademicApproval', 'AcademicallyApproved', 'FinanceProcessed', 'Completed'].includes(application.status) ? (
                    <div className="text-center py-4 bg-success bg-opacity-10 border border-success border-opacity-25 rounded-4">
                      <i className="bi bi-check-all text-success fs-1 mb-2 d-block"></i>
                      <h6 className="fw-bold text-dark mb-1">Report Uploaded Successfully</h6>
                      <button type="button" onClick={() => handleViewPdf(application.reportUrl)} className="btn btn-outline-success fw-bold rounded-pill mt-3 px-4">
                        View Uploaded PDF <i className="bi bi-box-arrow-up-right ms-1"></i>
                      </button>
                    </div>
                  ) : application.status === 'CompanyEvaluated' ? (
                     <form onSubmit={handleReportSubmit} className="mb-2">
                       <div className="mb-4">
                         <div className={`file-upload-wrapper ${reportFile ? 'border-primary bg-primary bg-opacity-10' : ''}`}>
                           <input type="file" className="file-upload-input" accept="application/pdf" onChange={(e) => { if(e.target.files[0]) setReportFile(e.target.files[0]); }} required />
                           <i className={`bi ${reportFile ? 'bi-file-earmark-pdf-fill text-danger' : 'bi-cloud-arrow-up text-primary'} fs-1 mb-2 d-block`}></i>
                           <h6 className="fw-bolder text-dark mb-1">{reportFile ? reportFile.name : 'Click to Browse or Drag PDF Here'}</h6>
                           <p className="small text-muted mb-0">{reportFile ? `File size: ${(reportFile.size / 1024 / 1024).toFixed(2)} MB` : 'Max database upload size: 1MB (.pdf only)'}</p>
                           {reportFile && (
                             <button type="button" className="btn btn-sm btn-outline-danger fw-bold rounded-pill mt-3 px-4 shadow-sm" onClick={(e) => { e.preventDefault(); const fileUrl = URL.createObjectURL(reportFile); window.open(fileUrl, '_blank'); }} style={{ position: 'relative', zIndex: 10 }}>
                               <i className="bi bi-eye-fill me-1"></i> Preview PDF Locally
                             </button>
                           )}
                         </div>
                       </div>
                       <button type="submit" className="btn-premium" style={{ background: '#10B981' }} disabled={processing || !reportFile}>
                         {processing ? <span className="spinner-border spinner-border-sm"></span> : <><i className="bi bi-send-check-fill"></i> Send to Department</>}
                       </button>
                     </form>
                  ) : (
                     <div className="text-center p-4 rounded bg-light border">
                       <i className="bi bi-lock-fill fs-2 text-muted opacity-50 mb-3 d-block"></i>
                       <h6 className="fw-bold text-dark">Upload Locked</h6>
                       <p className="small text-muted mb-0">You must wait for your corporate host to submit your final performance evaluation before you can upload your report.</p>
                     </div>
                  )}
                </div>
              )}
            </div>

            <div className="col-lg-6">
              <div className="glass-panel h-100">
                <h5 className="fw-bolder mb-4">Clearance & Evaluations</h5>
                
                {currentStage < 4 ? (
                  <div className="text-center p-4 rounded bg-light border mt-4">
                     <i className="bi bi-lock-fill fs-2 text-muted opacity-50 mb-2 d-block"></i>
                     <p className="small text-muted mb-0">Evaluations and clearances will appear here once your internship is complete.</p>
                  </div>
                ) : (
                  <>
                    {['CompanyEvaluated', 'ReportSubmitted', 'PendingAcademicApproval', 'AcademicallyApproved', 'FinanceProcessed', 'Completed'].includes(application.status) ? (
                      <div className="p-4 border rounded-4 bg-light mb-4">
                        <p className="fw-bold text-uppercase mb-1 small text-muted" style={{ letterSpacing: '1px' }}>Corporate Evaluation</p>
                        <h3 className="fw-bolder text-success mb-2">{application.companyScore}/100</h3>
                        <p className="text-dark fw-medium mb-0 small fst-italic">"{application.companyReport}"</p>
                      </div>
                    ) : (
                      <div className="p-4 border rounded-4 text-center bg-light mb-4">
                        <p className="small fw-bold text-muted mb-0">Waiting for Company evaluation...</p>
                      </div>
                    )}

                    {currentStage >= 5 && (
                      <>
                        <div className="d-flex align-items-center mb-3 p-3 rounded-3" style={{ background: application.status === 'PendingAcademicApproval' ? '#FFFBEB' : '#ECFDF5', border: `1px solid ${application.status === 'PendingAcademicApproval' ? '#FCD34D' : '#6EE7B7'}` }}>
                          <i className={`bi ${application.status === 'PendingAcademicApproval' ? 'bi-clock-history text-warning' : 'bi-check-circle-fill text-success'} fs-3 me-3`}></i>
                          <div>
                            <h6 className="fw-bold mb-0 text-dark">Deputy Director Approval</h6>
                            <p className="small mb-0 text-muted">{application.status === 'PendingAcademicApproval' ? 'Under Review' : 'Academically Cleared'}</p>
                          </div>
                        </div>

                        <div className="d-flex align-items-center mb-4 p-3 rounded-3" style={{ background: ['FinanceProcessed', 'Completed'].includes(application.status) ? '#ECFDF5' : '#F8FAFC', border: `1px solid ${['FinanceProcessed', 'Completed'].includes(application.status) ? '#6EE7B7' : '#E2E8F0'}` }}>
                          <i className={`bi ${['FinanceProcessed', 'Completed'].includes(application.status) ? 'bi-check-circle-fill text-success' : 'bi-lock-fill text-muted'} fs-3 me-3`}></i>
                          <div>
                            <h6 className="fw-bold mb-0 text-dark">Finance Office Fund Processing</h6>
                            <p className="small mb-0 text-muted">{['FinanceProcessed', 'Completed'].includes(application.status) ? 'Stipend Disbursed' : 'Awaiting Processing'}</p>
                          </div>
                        </div>

                        {['FinanceProcessed', 'Completed'].includes(application.status) && (
                          <button className="btn-premium w-100 mt-2" style={{ background: 'linear-gradient(135deg, #0055FF 0%, #003399 100%)', padding: '20px' }} onClick={generateCertificate}>
                            <i className="bi bi-file-earmark-pdf-fill fs-4"></i> Download Clearance Certificate
                          </button>
                        )}
                      </>
                    )}
                  </>
                )}
              </div>
            </div>

          </div>
        </div>
      )}
    </Layout>
  );
};

export default StudentDashboard;