import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TeacherShell } from './main';
describe('TeacherShell', () => { it('has an accessible audience heading', () => { render(<TeacherShell />); expect(screen.getByRole('heading', { name: 'PassionEdu - Giáo viên' })).toBeTruthy(); }); });
