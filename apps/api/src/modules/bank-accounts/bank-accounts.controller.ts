import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { BankAccountStatus } from '@prisma/client';
import { BankAccountsService } from './bank-accounts.service.js';
import { BankAccountIdDto, CreateBankAccountDto, ListBankAccountsDto } from './bank-accounts.dto.js';

@Controller('bank-accounts')
export class BankAccountsController {
  constructor(private readonly accounts: BankAccountsService) {}
  @Get() list(@Query() query: ListBankAccountsDto) { return this.accounts.list(query); }
  @Get(':id') get(@Param() params: BankAccountIdDto) { return this.accounts.get(params.id); }
  @Post() create(@Body() body: CreateBankAccountDto) { return this.accounts.create(body); }
  @Post(':id/activate') activate(@Param() params: BankAccountIdDto) { return this.accounts.setStatus(params.id, BankAccountStatus.ACTIVE); }
  @Post(':id/deactivate') deactivate(@Param() params: BankAccountIdDto) { return this.accounts.setStatus(params.id, BankAccountStatus.INACTIVE); }
}
