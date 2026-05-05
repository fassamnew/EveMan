import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders registration navigation', () => {
  render(<App />);
  const registrationButton = screen.getByText(/Registration/i);
  expect(registrationButton).toBeInTheDocument();
});
