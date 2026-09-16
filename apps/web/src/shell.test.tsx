import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { AdminShell } from './main';
describe('AdminShell', () => { it('has an accessible audience heading', () => { render(<AdminShell />); expect(screen.getByRole('heading', { name: 'PassionEdu - Quản trị trường' })).toBeTruthy(); }); });
