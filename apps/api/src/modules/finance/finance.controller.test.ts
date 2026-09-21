import { describe, expect, it, vi } from 'vitest';
import { FinanceController } from './finance.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
const valid = { origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'token' };

describe('FinanceController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const finance = { read: vi.fn(), operation: vi.fn(), invoice: vi.fn(), bankAccounts: vi.fn(), issueInvoice: vi.fn(), createGroup: vi.fn(), createReceivable: vi.fn(), transitionGroup: vi.fn(), transitionReceivable: vi.fn(), generateRun: vi.fn(), addGeneratedStudent: vi.fn(), addInvoiceLine: vi.fn(), editInvoiceLine: vi.fn(), removeInvoiceLine: vi.fn() };
  it('requires browser mutation proof before Finance writes', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    await expect(controller.group(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(finance.createGroup).not.toHaveBeenCalled();
  });
  it('passes session identity and mutation proof to catalog creation and lifecycle commands', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.createReceivable.mockResolvedValue({ id: 'operation' }); finance.transitionGroup.mockResolvedValue({ id: 'transition' });
    await expect(controller.receivable(request(valid), 'school', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'operation' } });
    await expect(controller.groupLifecycle(request(valid), 'school', 'group', 'key', 'operation', {})).resolves.toEqual({ data: { id: 'transition' } });
    expect(finance.createReceivable).toHaveBeenCalledWith('actor-id', 'school', 'key', 'operation', {});
  });
  it('passes browser mutation proof and idempotency headers to generate', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.generateRun.mockResolvedValue({ id: 'operation' });
    await expect(controller.generate(request(valid), 'school', 'run', 'key', 'operation')).resolves.toEqual({ data: { id: 'operation' } });
    expect(finance.generateRun).toHaveBeenCalledWith('actor-id', 'school', 'run', 'key', 'operation');
  });
  it('rejects generate without CSRF/origin proof before reaching Finance', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.generateRun.mockClear();
    await expect(controller.generate(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'run', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    expect(finance.generateRun).not.toHaveBeenCalled();
  });
  it('passes one requested Student to the generated-run addition command', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.addGeneratedStudent.mockResolvedValue({ id: 'operation' });
    await expect(controller.addGeneratedStudent(request(valid), 'school', 'run', 'key', 'operation', { studentId: 'student' })).resolves.toEqual({ data: { id: 'operation' } });
    expect(finance.addGeneratedStudent).toHaveBeenCalledWith('actor-id', 'school', 'run', 'key', 'operation', { studentId: 'student' });
  });
  it('rejects generated-students without CSRF/origin proof before reaching Finance', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.addGeneratedStudent.mockClear();
    await expect(controller.addGeneratedStudent(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'run', 'key', 'operation', { studentId: 'student' })).rejects.toMatchObject({ status: 401 });
    expect(finance.addGeneratedStudent).not.toHaveBeenCalled();
  });
  it('passes browser mutation proof and identifiers to Invoice line commands', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.addInvoiceLine.mockResolvedValue({ id: 'add' }); finance.editInvoiceLine.mockResolvedValue({ id: 'edit' }); finance.removeInvoiceLine.mockResolvedValue({ id: 'remove' });
    await expect(controller.addInvoiceLine(request(valid), 'school', 'invoice', 'key', 'operation', { quantity: '1' })).resolves.toEqual({ data: { id: 'add' } });
    await expect(controller.editInvoiceLine(request(valid), 'school', 'invoice', 'line', 'key', 'operation', { quantity: '2' })).resolves.toEqual({ data: { id: 'edit' } });
    await expect(controller.removeInvoiceLine(request(valid), 'school', 'invoice', 'line', 'key', 'operation')).resolves.toEqual({ data: { id: 'remove' } });
    expect(finance.addInvoiceLine).toHaveBeenCalledWith('actor-id', 'school', 'invoice', 'key', 'operation', { quantity: '1' });
    expect(finance.editInvoiceLine).toHaveBeenCalledWith('actor-id', 'school', 'invoice', 'line', 'key', 'operation', { quantity: '2' });
  });
  it('rejects Invoice line writes without CSRF/origin proof', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.addInvoiceLine.mockClear();
    await expect(controller.addInvoiceLine(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'invoice', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(finance.addInvoiceLine).not.toHaveBeenCalled();
  });
  it('forwards session identity and school scope to Invoice detail', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.invoice.mockResolvedValue({ id: 'invoice' });
    await expect(controller.invoice(request({}), 'school', 'invoice')).resolves.toEqual({ data: { id: 'invoice' } });
    expect(finance.invoice).toHaveBeenCalledWith('actor-id', 'school', 'invoice');
  });
  it('projects active bank accounts and passes only the protected issue command through', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.bankAccounts.mockResolvedValue({ accounts: [{ id: 'bank' }] }); finance.issueInvoice.mockResolvedValue({ id: 'operation' });
    await expect(controller.bankAccounts(request({}), 'school')).resolves.toEqual({ data: { accounts: [{ id: 'bank' }] } });
    await expect(controller.issueInvoice(request(valid), 'school', 'invoice', 'key', 'operation', { bankAccountId: 'bank', total: '1' })).resolves.toEqual({ data: { id: 'operation' } });
    expect(finance.bankAccounts).toHaveBeenCalledWith('actor-id', 'school');
    expect(finance.issueInvoice).toHaveBeenCalledWith('actor-id', 'school', 'invoice', 'key', 'operation', { bankAccountId: 'bank', total: '1' });
  });
  it('rejects issue before Finance when origin or CSRF proof is absent', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.issueInvoice.mockClear();
    await expect(controller.issueInvoice(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'invoice', 'key', 'operation', { bankAccountId: 'bank' })).rejects.toMatchObject({ status: 401 });
    expect(finance.issueInvoice).not.toHaveBeenCalled();
  });
});
