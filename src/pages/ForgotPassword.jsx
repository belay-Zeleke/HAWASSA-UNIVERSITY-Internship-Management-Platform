import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendPasswordResetEmail } from 'firebase/auth';
import { auth } from '../firebase-config';
import 'bootstrap/dist/css/bootstrap.min.css';

import huLogo from '../assets/hu-logo.jpg'; 

const ForgotPassword = () => {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setMessage('');

    try {
      await sendPasswordResetEmail(auth, email.trim());
      setMessage('Success! A password reset link has been sent to your official email address. Please check your inbox and spam folder.');
      setEmail(''); // Clear the input after success
    } catch (err) {
      console.error("Password Reset Error:", err);
      // Generic error for security, or specific if network fails
      if (err.code === 'auth/network-request-failed') {
        setError('Network Error: Unable to connect. Please check your internet connection.');
      } else {
        setError('If this email is registered, a reset link will be sent.');
      }
    }
    setLoading(false);
  };

  return (
    <div className="min-vh-100 d-flex align-items-center justify-content-center position-relative overflow-hidden" style={{ backgroundColor: '#EFF6FF' }}>
      
      <style>{`
        .auth-container { display: flex; width: 100%; min-height: 100vh; position: relative; z-index: 1; overflow: hidden; }
        
        .auth-banner { 
          flex: 1.2; 
          background-image: radial-gradient(circle at 20% 30%, rgba(255,255,255,0.1) 0%, transparent 40%),
                            radial-gradient(circle at 80% 70%, rgba(0, 85, 255, 0.15) 0%, transparent 40%),
                            linear-gradient(135deg, rgba(0, 26, 51, 0.98) 0%, rgba(0, 85, 255, 0.8) 100%);
          color: white; padding: 4rem; display: flex; flex-direction: column; justify-content: space-between; position: relative; 
          border-right: 1px solid rgba(255,255,255,0.05);
        }
        
        .auth-form-wrapper { flex: 1; padding: 3rem 4rem; display: flex; flex-direction: column; background: #ffffff; overflow-y: auto; max-height: 100vh; position: relative; justify-content: center; }

        .floating-group { position: relative; margin-bottom: 1.5rem; z-index: 1; }
        .floating-input {
          width: 100%; padding: 1.2rem 1rem 0.6rem; border: 1.5px solid #E2E8F0; 
          border-radius: 12px; background: #ffffff; font-size: 0.95rem; 
          color: #1E293B; transition: all 0.2s ease;
          box-shadow: 0 2px 4px rgba(0,0,0,0.02);
        }
        .floating-input:focus { border-color: #0055FF; background: #ffffff; box-shadow: 0 0 0 4px rgba(0, 85, 255, 0.1); outline: none; }
        .floating-label { position: absolute; left: 1rem; top: 50%; transform: translateY(-50%); color: #64748B; font-size: 0.95rem; pointer-events: none; transition: all 0.2s ease; font-weight: 500; }
        .floating-input:focus ~ .floating-label, .floating-input:not(:placeholder-shown) ~ .floating-label { top: 0.8rem; font-size: 0.7rem; color: #0055FF; font-weight: 800; letter-spacing: 0.5px; }

        .btn-premium { background: linear-gradient(135deg, #001A33 0%, #000E1C 100%); color: white; font-weight: 800; border: none; border-radius: 12px; padding: 16px 24px; font-size: 1rem; letter-spacing: 0.5px; transition: 0.3s; width: 100%; display: flex; align-items: center; justify-content: center; gap: 8px; z-index: 1; position: relative;}
        .btn-premium:hover:not(:disabled) { transform: translateY(-2px); box-shadow: 0 10px 25px rgba(0, 26, 51, 0.3); color: white; }
        .btn-premium:disabled { opacity: 0.7; cursor: not-allowed; }

        @media (max-width: 992px) {
          .auth-banner { display: none; }
          .auth-form-wrapper { padding: 3rem 2rem; }
        }

        .animate-fade-in { animation: slideUpFade 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; }
        @keyframes slideUpFade { from { opacity: 0; transform: translateY(15px); } to { opacity: 1; transform: translateY(0); } }
      `}</style>

      <div className="auth-container shadow-lg">
        
        {/* --- LEFT BANNER --- */}
        <div className="auth-banner d-none d-lg-flex">
          <div className="animate-fade-in" style={{ animationDelay: '0.1s' }}>
            <div className="d-flex align-items-center gap-3 mb-5">
              <div style={{ background: 'white', padding: '4px', borderRadius: '50%', display: 'inline-flex', boxShadow: '0 8px 24px rgba(0,0,0,0.2)' }}>
                <img src={huLogo} alt="Hawassa University" style={{ width: '60px', height: '60px', objectFit: 'cover', borderRadius: '50%' }} />
              </div>
              <div>
                <h4 className="fw-bolder mb-0 text-white" style={{ letterSpacing: '1px' }}>HAWASSA UNIVERSITY</h4>
                <span className="text-white-50 fw-bold small text-uppercase" style={{ letterSpacing: '2px' }}>Faculty of Informatics</span>
              </div>
            </div>
            
            <h1 className="fw-bolder mb-3 display-5 lh-sm">Password Recovery.</h1>
            <p className="fs-5 text-white-50 fw-medium lh-base pe-5">
              Enter your registered institutional email to receive secure instructions on how to reset your access credentials.
            </p>
          </div>
        </div>

        {/* --- RIGHT PANEL --- */}
        <div className="auth-form-wrapper">
          <div className="mb-4 animate-fade-in flex-shrink-0" style={{ position: 'relative', zIndex: 1 }}>
            <Link to="/login" className="text-decoration-none text-muted mb-3 d-inline-block fw-bold" style={{ fontSize: '0.85rem' }}>
              <i className="bi bi-arrow-left me-1"></i> Back to Login
            </Link>
            <h2 className="fw-bolder text-dark mb-1" style={{ letterSpacing: '-0.5px' }}>Reset Password</h2>
            <p className="text-muted fw-medium small">We will send a recovery link to your inbox.</p>
          </div>

          {error && (
            <div className="alert alert-danger d-flex align-items-center rounded-3 shadow-sm mb-4 border-0 p-3 animate-fade-in flex-shrink-0" style={{ backgroundColor: '#FEF2F2', color: '#991B1B' }}>
              <i className="bi bi-exclamation-octagon-fill fs-5 me-3 text-danger"></i>
              <span className="fw-bold" style={{ fontSize: '0.85rem' }}>{error}</span>
            </div>
          )}

          {message && (
            <div className="alert alert-success d-flex align-items-center rounded-3 shadow-sm mb-4 border-0 p-3 animate-fade-in flex-shrink-0" style={{ backgroundColor: '#ECFDF5', color: '#065F46' }}>
              <i className="bi bi-check-circle-fill fs-5 me-3 text-success"></i>
              <span className="fw-bold" style={{ fontSize: '0.85rem' }}>{message}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="d-flex flex-column" style={{ position: 'relative', zIndex: 1 }}>
            
            <div className="floating-group animate-fade-in" style={{ animationDelay: '0.1s' }}>
              <input 
                type="email" 
                className="floating-input" 
                placeholder=" " 
                value={email} 
                onChange={(e) => { setEmail(e.target.value); setError(''); setMessage(''); }} 
                required 
              />
              <label className="floating-label"> Email Address</label>
            </div>

            <button type="submit" className="btn-premium mt-3 animate-fade-in" style={{ animationDelay: '0.2s' }} disabled={loading}>
              {loading ? (
                <><span className="spinner-border spinner-border-sm me-2"></span> SENDING LINK...</>
              ) : (
                <><i className="bi bi-envelope-paper-fill me-2 fs-5"></i> SEND RECOVERY LINK</>
              )}
            </button>

          </form>
        </div>

      </div>
    </div>
  );
};

export default ForgotPassword;