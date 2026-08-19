import '@testing-library/jest-dom/vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { expect, it } from 'vitest';
import { Sidebar } from './sidebar';

const admin = { id: 'admin-1', email: 'admin@example.com', displayName: 'Ngọc Anh', avatarUrl: null, createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z' };

it('hiển thị toàn bộ điều hướng và trạng thái được chọn', () => {
  render(<MemoryRouter initialEntries={['/']}><Sidebar admin={admin} /></MemoryRouter>);
  expect(screen.getAllByRole('link')).toHaveLength(7);
  expect(screen.getByRole('link', { name: /Tổng quan/ })).toHaveClass('active');
  expect(screen.getByText('Ngọc Anh')).toBeVisible();
  expect(screen.getByLabelText('Ảnh đại diện mặc định của Ngọc Anh')).toHaveTextContent('N');
});

it('hiển thị avatar an toàn từ profile API khi có', () => {
  render(<MemoryRouter><Sidebar admin={{ ...admin, avatarUrl: 'https://images.example/avatar.png' }} /></MemoryRouter>);
  expect(screen.getByRole('img', { name: 'Ảnh đại diện của Ngọc Anh' })).toHaveAttribute('src', 'https://images.example/avatar.png');
  expect(screen.getByRole('img', { name: 'Ảnh đại diện của Ngọc Anh' })).toHaveAttribute('referrerpolicy', 'no-referrer');
});

it('thử lại avatar khi URL profile thay đổi', () => {
  const view = render(<MemoryRouter><Sidebar admin={{ ...admin, avatarUrl: 'https://images.example/old.png' }} /></MemoryRouter>);
  fireEvent.error(screen.getByRole('img'));
  expect(screen.getByLabelText('Ảnh đại diện mặc định của Ngọc Anh')).toBeVisible();
  view.rerender(<MemoryRouter><Sidebar admin={{ ...admin, avatarUrl: 'https://images.example/new.png' }} /></MemoryRouter>);
  expect(screen.getByRole('img', { name: 'Ảnh đại diện của Ngọc Anh' })).toHaveAttribute('src', 'https://images.example/new.png');
});

it('trở về initials có nhãn nếu avatar không tải được và normalize tên trống', () => {
  render(<MemoryRouter><Sidebar admin={{ ...admin, displayName: '   ', avatarUrl: 'https://images.example/avatar.png' }} /></MemoryRouter>);
  fireEvent.error(screen.getByRole('img', { name: 'Ảnh đại diện của Quản trị viên' }));
  expect(screen.getByLabelText('Ảnh đại diện mặc định của Quản trị viên')).toHaveTextContent('Q');
  expect(screen.getByText('Quản trị viên')).toBeVisible();
});
