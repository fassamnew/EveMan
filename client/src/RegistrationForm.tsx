import React, { useState } from 'react';

const RegistrationForm: React.FC = () => {
  const [formData, setFormData] = useState({
    fullName: '',
    designation: '',
    company: '',
    email: '',
    phone: '',
    category: 'Delegate'
  });
  const [status, setStatus] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setStatus('Submitting...');
    try {
      const response = await fetch('http://localhost:5001/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });
      if (response.ok) {
        setStatus('Registration Successful! Your badge will be emailed.');
        setFormData({ fullName: '', designation: '', company: '', email: '', phone: '', category: 'Delegate' });
      } else {
        setStatus('Error occurred. Please try again.');
      }
    } catch (err) {
      setStatus('Could not connect to server.');
    }
  };

  return (
    <div style={{ maxWidth: '500px', margin: 'auto', padding: '20px', fontFamily: 'sans-serif' }}>
      <h2>NH Event Registration</h2>
      <form onSubmit={handleSubmit}>
        <div style={{ marginBottom: '10px' }}>
          <label>Full Name</label><br/>
          <input style={{ width: '100%' }} type="text" required value={formData.fullName} onChange={e => setFormData({...formData, fullName: e.target.value})} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Email</label><br/>
          <input style={{ width: '100%' }} type="email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Company</label><br/>
          <input style={{ width: '100%' }} type="text" value={formData.company} onChange={e => setFormData({...formData, company: e.target.value})} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Designation</label><br/>
          <input style={{ width: '100%' }} type="text" value={formData.designation} onChange={e => setFormData({...formData, designation: e.target.value})} />
        </div>
        <div style={{ marginBottom: '10px' }}>
          <label>Category</label><br/>
          <select style={{ width: '100%' }} value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})}>
            <option value="Delegate">Delegate</option>
            <option value="Media">Media</option>
          </select>
        </div>
        <button type="submit" style={{ padding: '10px 20px', background: '#007bff', color: '#fff', border: 'none', cursor: 'pointer' }}>Register</button>
      </form>
      {status && <p>{status}</p>}
    </div>
  );
};

export default RegistrationForm;