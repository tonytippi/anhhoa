import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { OpsShell } from './main';
describe('OpsShell', () => { it('has an accessible audience heading', () => { render(<OpsShell />); expect(screen.getByRole('heading', { name: 'PassionEdu - Vận hành nền tảng' })).toBeTruthy(); }); });
