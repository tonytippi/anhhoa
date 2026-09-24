import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ParentShell } from './main';

afterEach(() => { cleanup(); vi.unstubAllGlobals(); document.cookie = 'parent_csrf=; Max-Age=0'; });

describe('ParentShell', () => {
  it('keeps protected content hidden after a 401 startup response and exposes Google login', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })));
    render(<ParentShell />);
    await screen.findByRole('link', { name: 'Đăng nhập với Google' });
    expect(screen.queryByText('Cổng phụ huynh đang được khởi tạo.')).toBeNull();
  });

  it('renders only server-authorized Parent contexts in the workspace switcher', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(JSON.stringify({ data: { audience: 'parent', userIdentityId: 'identity', email: 'parent@example.com', schools: [{ schoolId: 'school-a', schoolName: 'Trường A', student: { id: 'student-a', fullName: 'Bé An' } }, { schoolId: 'school-b', schoolName: 'Trường B', student: { id: 'student-b', fullName: 'Bé Bình' } }] } }))));
    render(<ParentShell />);
    expect(await screen.findByRole('heading', { name: 'Hôm nay của các con' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Trường A · Bé An' })).toBeTruthy();
    expect(screen.getByRole('option', { name: 'Trường B · Bé Bình' })).toBeTruthy();
  });

});
