import { describe, it, expect } from 'vitest';
import { Account, Asset, Keypair, Networks, Operation, TransactionBuilder } from '@stellar/stellar-sdk';
import { readCoSignRequest } from '@core/miniapps/coSign';

const sponsor = Keypair.random();
const wallet = Keypair.random().publicKey();
const usdc = new Asset('USDC', Keypair.random().publicKey());

// The shape Centient's payout setup sends: the sponsor creates the wallet's
// account and its USDC trustline, paying every reserve, and signs first.
function sponsoredSetup(passphrase = Networks.TESTNET) {
  const tx = new TransactionBuilder(new Account(sponsor.publicKey(), '1'), { fee: '400', networkPassphrase: passphrase })
    .addOperation(Operation.beginSponsoringFutureReserves({ sponsoredId: wallet }))
    .addOperation(Operation.createAccount({ destination: wallet, startingBalance: '0' }))
    .addOperation(Operation.changeTrust({ asset: usdc, source: wallet }))
    .addOperation(Operation.endSponsoringFutureReserves({ source: wallet }))
    .setTimeout(300)
    .build();
  tx.sign(sponsor);
  return tx.toXDR();
}

describe('lantern:signXdr requests', () => {
  it('reads a sponsored account setup into plain lines', () => {
    const res = readCoSignRequest({ xdr: sponsoredSetup(), networkPassphrase: Networks.TESTNET }, Networks.TESTNET, wallet);
    expect(res.ok).toBe(true);
    if (!res.ok) return;
    expect(res.value.source).toBe(sponsor.publicKey());
    expect(res.value.touchesWallet).toBe(true);
    expect(res.value.operations).toEqual([
      'Start paying reserves for your account',
      'Create your account with 0 XLM',
      'your account: Add a USDC trustline',
      'your account: Stop paying reserves',
    ]);
  });

  it('refuses a request for another network', () => {
    const res = readCoSignRequest({ xdr: sponsoredSetup(), networkPassphrase: Networks.PUBLIC }, Networks.TESTNET, wallet);
    expect(res).toEqual({ ok: false, error: expect.stringContaining('different network') });
  });

  it('refuses a missing or unreadable transaction', () => {
    expect(readCoSignRequest({ networkPassphrase: Networks.TESTNET }, Networks.TESTNET, wallet).ok).toBe(false);
    expect(readCoSignRequest({ xdr: 'AAAA', networkPassphrase: Networks.TESTNET }, Networks.TESTNET, wallet)).toEqual({
      ok: false,
      error: 'The transaction could not be read.',
    });
  });

  it('refuses a fee-bump envelope', () => {
    const inner = TransactionBuilder.fromXDR(sponsoredSetup(), Networks.TESTNET);
    const bump = TransactionBuilder.buildFeeBumpTransaction(sponsor, '1000', inner as never, Networks.TESTNET);
    const res = readCoSignRequest({ xdr: bump.toXDR(), networkPassphrase: Networks.TESTNET }, Networks.TESTNET, wallet);
    expect(res).toEqual({ ok: false, error: expect.stringContaining('Fee-bump') });
  });
});
