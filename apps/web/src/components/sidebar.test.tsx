import '@testing-library/jest-dom/vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { Sidebar } from './sidebar';

it('hiển thị toàn bộ điều hướng và trạng thái được chọn', () => {
  render(<MemoryRouter initialEntries={['/']}><Sidebar /></MemoryRouter>);
  expect(screen.getAllByRole('link')).toHaveLength(7);
  expect(screen.getByRole('link', { name: /Tổng quan/ })).toHaveClass('active');
  expect(screen.getByRole('button', { name: 'Admin' })).toBeVisible();
});
