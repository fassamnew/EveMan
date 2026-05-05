const React = require('react');

function StatusBadge({ label, tone = 'neutral' }) {
  const toneStyles = {
    neutral: { backgroundColor: '#e5e7eb', color: '#111827' },
    success: { backgroundColor: '#dcfce7', color: '#166534' },
    warning: { backgroundColor: '#fef3c7', color: '#92400e' },
    error: { backgroundColor: '#fee2e2', color: '#991b1b' }
  };

  const style = {
    display: 'inline-block',
    borderRadius: '9999px',
    padding: '0.2rem 0.7rem',
    fontSize: '0.85rem',
    fontWeight: 600,
    ...toneStyles[tone]
  };

  return React.createElement('span', { style }, label);
}

module.exports = {
  StatusBadge
};
