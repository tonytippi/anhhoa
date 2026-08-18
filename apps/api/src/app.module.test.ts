import { describe, expect, it } from 'vitest';
import { AppModule } from './app.module.js';

describe('AppModule', () => {
  it('khởi tạo module gốc tối thiểu', () => {
    expect(AppModule).toBeDefined();
  });
});
