// `lantern:signXdr` — a dApp asks the wallet to add its signature to a
// transaction the dApp built (and may already have signed, e.g. as a sponsor),
// without submitting it. The dApp submits. This is the SIGN_ONLY action the
// signer already has (guardian co-signing uses it), exposed over the bridge.
//
// This module reads the request so the approval sheet can say what it does.
// It refuses what the sheet can't honestly describe: an envelope for another
// network (the passphrase is part of the signed hash, so a mismatch means the
// signature is for a different chain than the one the user is on) and fee-bump
// envelopes (the inner transaction is what the user would be agreeing to).
import { Asset, FeeBumpTransaction, TransactionBuilder, type Transaction } from '@stellar/stellar-sdk';

/** A parsed operation, as `Transaction.operations` holds it. */
type ParsedOperation = Transaction['operations'][number];

export interface CoSignRequest {
  xdr: string;
  /** The transaction's source account: who pays the fee and sequence. */
  source: string;
  /** Total fee cap in stroops, as the envelope states it. */
  fee: string;
  /** One line per operation, in order. */
  operations: string[];
  /** True when at least one operation runs as the wallet's own account. */
  touchesWallet: boolean;
}

export type CoSignResult = { ok: true; value: CoSignRequest } | { ok: false; error: string };

/** Read a `lantern:signXdr` request against the wallet's network and address. */
export function readCoSignRequest(
  raw: { xdr?: unknown; networkPassphrase?: unknown },
  walletPassphrase: string,
  walletAddress: string,
): CoSignResult {
  if (typeof raw.xdr !== 'string' || raw.xdr.trim() === '') {
    return { ok: false, error: 'The request has no transaction to sign.' };
  }
  if (raw.networkPassphrase !== walletPassphrase) {
    return { ok: false, error: 'The transaction is for a different network than the wallet is on.' };
  }
  const xdr = raw.xdr.trim();
  let tx: Transaction | FeeBumpTransaction;
  try {
    tx = TransactionBuilder.fromXDR(xdr, walletPassphrase);
  } catch {
    return { ok: false, error: 'The transaction could not be read.' };
  }
  if (tx instanceof FeeBumpTransaction) {
    return { ok: false, error: 'Fee-bump transactions can’t be co-signed here.' };
  }
  const operations = tx.operations.map((op) => describeOperation(op, tx.source, walletAddress));
  const touchesWallet =
    tx.source === walletAddress || tx.operations.some((op) => (op.source ?? tx.source) === walletAddress);
  return { ok: true, value: { xdr, source: tx.source, fee: tx.fee, operations, touchesWallet } };
}

function short(address: string, wallet: string): string {
  if (address === wallet) return 'your account';
  return address.length > 12 ? `${address.slice(0, 5)}…${address.slice(-5)}` : address;
}

// "0.0000000" → "0", "12.5000000" → "12.5": the SDK pads to 7 decimals.
function amount(value: string): string {
  return value.includes('.') ? value.replace(/\.?0+$/, '') : value;
}

function assetLabel(asset: unknown): string {
  if (asset instanceof Asset) return asset.isNative() ? 'XLM' : asset.getCode();
  return 'pool share';
}

/** One plain line for an operation. Unlisted types fall back to their name. */
export function describeOperation(op: ParsedOperation, txSource: string, wallet: string): string {
  const actor = op.source && op.source !== txSource ? `${short(op.source, wallet)}: ` : '';
  switch (op.type) {
    case 'createAccount': {
      const who = op.destination === wallet ? 'your account' : `account ${short(op.destination, wallet)}`;
      return `${actor}Create ${who} with ${amount(op.startingBalance)} XLM`;
    }
    case 'payment':
      return `${actor}Pay ${amount(op.amount)} ${assetLabel(op.asset)} to ${short(op.destination, wallet)}`;
    case 'changeTrust':
      return Number(op.limit) === 0
        ? `${actor}Remove the ${assetLabel(op.line)} trustline`
        : `${actor}Add a ${assetLabel(op.line)} trustline`;
    case 'beginSponsoringFutureReserves':
      return `${actor}Start paying reserves for ${short(op.sponsoredId, wallet)}`;
    case 'endSponsoringFutureReserves':
      return `${actor}Stop paying reserves`;
    case 'setOptions':
      return `${actor}Change account settings (signers, thresholds or flags)`;
    case 'manageData':
      return `${actor}Set data entry “${op.name}”`;
    case 'accountMerge':
      return `${actor}Merge the account into ${short(op.destination, wallet)} (closes it)`;
    default:
      return `${actor}${op.type}`;
  }
}
