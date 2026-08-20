import { Matches } from 'class-validator';

export class MonthlyReportDto {
  @Matches(/^(?!0000)\d{4}-(0[1-9]|1[0-2])$/)
  billingMonth!: string;
}
