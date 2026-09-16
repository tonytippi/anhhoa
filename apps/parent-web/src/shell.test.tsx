import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { ParentShell } from './main';
describe('ParentShell', () => { it('has an accessible audience heading', () => { render(<ParentShell />); expect(screen.getByRole('heading', { name: 'PassionEdu' })).toBeTruthy(); }); });
