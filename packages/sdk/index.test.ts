import {test} from 'node:test';
import assert from 'node:assert/strict';
import {encodeEventTopics, encodeAbiParameters} from 'viem';
import {assetUnits, positionIdFromReceipt, MarketVaultAbi} from './index';

test('asset units reject ambiguous and lossy inputs', () => {
  assert.equal(assetUnits('1.000001', 6), 1_000_001n);
  for (const value of ['0', '-1', '1e6', ' 1', '1.0000001', 'NaN', '.1', '01']) {
    assert.throws(() => assetUnits(value, 6));
  }
  assert.throws(() => assetUnits('1', -1));
  assert.equal(assetUnits('0.000001', 6), 1n);
});

test('position IDs come from matching confirmed contract events', () => {
  const vault = '0x1111111111111111111111111111111111111111';
  const trader = '0x2222222222222222222222222222222222222222';
  const topics = encodeEventTopics({abi: MarketVaultAbi, eventName: 'PositionOpened', args: {id: 7n, trader}}) as [`0x${string}`, ...`0x${string}`[]];
  // Only five nonindexed uint256 values follow isLong: collateral, notional, price, reserve, deadline.
  const validData = encodeAbiParameters([{type:'bool'}, ...Array.from({length:5}, () => ({type:'uint256'} as const))], [true, 10n, 50n, 200n, 10n, 500n]);
  assert.equal(positionIdFromReceipt([{address:vault,topics,data:validData}], vault), 7n);
  assert.throws(() => positionIdFromReceipt([{address:trader,topics,data:validData}], vault));
  assert.throws(() => positionIdFromReceipt([], vault));
});
