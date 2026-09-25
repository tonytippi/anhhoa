import { describe, expect, it, vi } from 'vitest';
import { FinanceController } from './finance.controller.js';

const request = (headers: Record<string, string | undefined>) => ({ headers });
const valid = { origin: 'http://localhost:5173', cookie: 'app_csrf=token', 'x-csrf-token': 'token' };

describe('FinanceController mutation boundary', () => {
  const auth = { session: vi.fn().mockReturnValue({ userIdentityId: 'actor-id' }) };
  const finance = { read: vi.fn(), operation: vi.fn(), invoice: vi.fn(), bankAccounts: vi.fn(), issueInvoice: vi.fn(), closeInvoice: vi.fn(), prepareRevision: vi.fn(), issueRevision: vi.fn(), createGroup: vi.fn(), createReceivable: vi.fn(), transitionGroup: vi.fn(), transitionReceivable: vi.fn(), generateRun: vi.fn(), pauseGeneration: vi.fn(), resumeGeneration: vi.fn(), addGeneratedStudent: vi.fn(), saveTemplateLine: vi.fn(), removeTemplateLine: vi.fn(), closeRun: vi.fn(), addInvoiceLine: vi.fn(), editInvoiceLine: vi.fn(), removeInvoiceLine: vi.fn(), promotionPolicies: vi.fn(), promotionStudents: vi.fn(), createPromotionPolicy: vi.fn(), activatePromotionVersion: vi.fn(), retirePromotionVersion: vi.fn(), assignPromotionStudents: vi.fn(), endPromotionAssignment: vi.fn() };
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
  it('forwards protected DRAFT template commands without browser pricing fields', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.saveTemplateLine.mockResolvedValue({ id: 'save' }); finance.removeTemplateLine.mockResolvedValue({ id: 'remove' });
    await expect(controller.template(request(valid), 'school', 'run', 'key', 'operation', { receivableId: 'receivable', quantity: '22', expectedVersion: 2 })).resolves.toEqual({ data: { id: 'save' } });
    await expect(controller.removeTemplate(request(valid), 'school', 'run', 'line', 'key', 'operation', { expectedVersion: 3 })).resolves.toEqual({ data: { id: 'remove' } });
    expect(finance.saveTemplateLine).toHaveBeenCalledWith('actor-id', 'school', 'run', 'key', 'operation', { receivableId: 'receivable', quantity: '22', expectedVersion: 2 });
    expect(finance.removeTemplateLine).toHaveBeenCalledWith('actor-id', 'school', 'run', 'line', 'key', 'operation', { expectedVersion: 3 });
  });
  it('rejects generate without CSRF/origin proof before reaching Finance', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.generateRun.mockClear();
    await expect(controller.generate(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'run', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    expect(finance.generateRun).not.toHaveBeenCalled();
  });
  it('passes browser mutation proof to pause and resume generation', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.pauseGeneration.mockResolvedValue({ id: 'pause' }); finance.resumeGeneration.mockResolvedValue({ id: 'resume' });
    await expect(controller.pauseGeneration(request(valid), 'school', 'run', 'key', 'operation')).resolves.toEqual({ data: { id: 'pause' } });
    await expect(controller.resumeGeneration(request(valid), 'school', 'run', 'key', 'operation')).resolves.toEqual({ data: { id: 'resume' } });
    expect(finance.pauseGeneration).toHaveBeenCalledWith('actor-id', 'school', 'run', 'key', 'operation');
    expect(finance.resumeGeneration).toHaveBeenCalledWith('actor-id', 'school', 'run', 'key', 'operation');
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
  it('forwards the protected close command with its reason', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.closeRun.mockResolvedValue({ id: 'close' });
    await expect(controller.closeRun(request(valid), 'school', 'run', 'key', 'operation', { reason: 'Đã rà soát' })).resolves.toEqual({ data: { id: 'close' } });
    expect(finance.closeRun).toHaveBeenCalledWith('actor-id', 'school', 'run', 'key', 'operation', { reason: 'Đã rà soát' });
  });
  it('rejects close without origin and CSRF proof before reaching Finance', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.closeRun.mockClear();
    await expect(controller.closeRun(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'run', 'key', 'operation', { reason: 'Đã rà soát' })).rejects.toMatchObject({ status: 401 });
    expect(finance.closeRun).not.toHaveBeenCalled();
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
  it('forwards actual receipt only through the protected one-Invoice close command', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.closeInvoice.mockResolvedValue({ id: 'close' });
    await expect(controller.closeInvoice(request(valid), 'school', 'invoice', 'key', 'operation', { actualAmount: '90000' })).resolves.toEqual({ data: { id: 'close' } });
    expect(finance.closeInvoice).toHaveBeenCalledWith('actor-id', 'school', 'invoice', 'key', 'operation', { actualAmount: '90000' });
  });
  it('rejects receipt close without origin and CSRF proof before reaching Finance', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.closeInvoice.mockClear();
    await expect(controller.closeInvoice(request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' }), 'school', 'invoice', 'key', 'operation', { actualAmount: '90000' })).rejects.toMatchObject({ status: 401 });
    expect(finance.closeInvoice).not.toHaveBeenCalled();
  });
  it('forwards protected revision commands with their server-authoritative inputs', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.prepareRevision.mockResolvedValue({ id: 'prepare' }); finance.issueRevision.mockResolvedValue({ id: 'issue' });
    await expect(controller.prepareRevision(request(valid), 'school', 'source', 'key', 'operation', { reason: 'Sai khoản thu' })).resolves.toEqual({ data: { id: 'prepare' } });
    await expect(controller.issueRevision(request(valid), 'school', 'replacement', 'key', 'operation', { bankAccountId: 'bank' })).resolves.toEqual({ data: { id: 'issue' } });
    expect(finance.prepareRevision).toHaveBeenCalledWith('actor-id', 'school', 'source', 'key', 'operation', { reason: 'Sai khoản thu' });
    expect(finance.issueRevision).toHaveBeenCalledWith('actor-id', 'school', 'replacement', 'key', 'operation', { bankAccountId: 'bank' });
  });
  it('rejects revision commands without origin and CSRF proof before reaching Finance', async () => {
    const controller = new FinanceController(auth as never, finance as never); finance.prepareRevision.mockClear(); finance.issueRevision.mockClear();
    const unprotected = request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' });
    await expect(controller.prepareRevision(unprotected, 'school', 'source', 'key', 'operation', { reason: 'Sai' })).rejects.toMatchObject({ status: 401 });
    await expect(controller.issueRevision(unprotected, 'school', 'replacement', 'key', 'operation', { bankAccountId: 'bank' })).rejects.toMatchObject({ status: 401 });
    expect(finance.prepareRevision).not.toHaveBeenCalled(); expect(finance.issueRevision).not.toHaveBeenCalled();
  });
  it('forwards promotion reads and all protected promotion commands', async () => {
    const controller = new FinanceController(auth as never, finance as never);
    finance.promotionPolicies.mockResolvedValue({ policies: [] }); finance.promotionStudents.mockResolvedValue({ students: [] }); finance.createPromotionPolicy.mockResolvedValue({ id: 'create' }); finance.activatePromotionVersion.mockResolvedValue({ id: 'activate' }); finance.retirePromotionVersion.mockResolvedValue({ id: 'retire' }); finance.assignPromotionStudents.mockResolvedValue({ id: 'assign' }); finance.endPromotionAssignment.mockResolvedValue({ id: 'end' });
    await expect(controller.promotionPolicies(request({}), 'school')).resolves.toEqual({ data: { policies: [] } });
    await expect(controller.promotionStudents(request({}), 'school')).resolves.toEqual({ data: { students: [] } });
    await expect(controller.createPromotionPolicy(request(valid), 'school', 'key', 'operation', { name: 'Ưu đãi' })).resolves.toEqual({ data: { id: 'create' } });
    await expect(controller.activatePromotionVersion(request(valid), 'school', 'version', 'key', 'operation')).resolves.toEqual({ data: { id: 'activate' } });
    await expect(controller.retirePromotionVersion(request(valid), 'school', 'version', 'key', 'operation')).resolves.toEqual({ data: { id: 'retire' } });
    await expect(controller.assignPromotionStudents(request(valid), 'school', 'version', 'key', 'operation', { studentIds: ['student'] })).resolves.toEqual({ data: { id: 'assign' } });
    await expect(controller.endPromotionAssignment(request(valid), 'school', 'assignment', 'key', 'operation', { effectiveTo: '2026-09-30', reason: 'Hết hạn' })).resolves.toEqual({ data: { id: 'end' } });
    expect(finance.promotionPolicies).toHaveBeenCalledWith('actor-id', 'school'); expect(finance.promotionStudents).toHaveBeenCalledWith('actor-id', 'school');
    expect(finance.assignPromotionStudents).toHaveBeenCalledWith('actor-id', 'school', 'version', 'key', 'operation', { studentIds: ['student'] });
    expect(finance.endPromotionAssignment).toHaveBeenCalledWith('actor-id', 'school', 'assignment', 'key', 'operation', { effectiveTo: '2026-09-30', reason: 'Hết hạn' });
  });
  it('denies every promotion mutation without origin and CSRF proof', async () => {
    const controller = new FinanceController(auth as never, finance as never); const unprotected = request({ cookie: 'app_csrf=token', 'x-csrf-token': 'token' });
    finance.createPromotionPolicy.mockClear(); finance.activatePromotionVersion.mockClear(); finance.retirePromotionVersion.mockClear(); finance.assignPromotionStudents.mockClear(); finance.endPromotionAssignment.mockClear();
    await expect(controller.createPromotionPolicy(unprotected, 'school', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.activatePromotionVersion(unprotected, 'school', 'version', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    await expect(controller.retirePromotionVersion(unprotected, 'school', 'version', 'key', 'operation')).rejects.toMatchObject({ status: 401 });
    await expect(controller.assignPromotionStudents(unprotected, 'school', 'version', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    await expect(controller.endPromotionAssignment(unprotected, 'school', 'assignment', 'key', 'operation', {})).rejects.toMatchObject({ status: 401 });
    expect(finance.createPromotionPolicy).not.toHaveBeenCalled(); expect(finance.activatePromotionVersion).not.toHaveBeenCalled(); expect(finance.retirePromotionVersion).not.toHaveBeenCalled(); expect(finance.assignPromotionStudents).not.toHaveBeenCalled(); expect(finance.endPromotionAssignment).not.toHaveBeenCalled();
  });
});
