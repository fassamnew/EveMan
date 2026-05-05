import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders organizer portal login', () => {
  render(<App />);
  const loginHeader = screen.getByText(/Organizer Portal/i);
  expect(loginHeader).toBeInTheDocument();
});
