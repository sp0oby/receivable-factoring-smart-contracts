// Chainlink Functions inline source (upload same text in Chainlink UI if you simulate there).
// args[0] = receivable token id, args[1] = repayment in wei (plain integer string, no scientific notation).
// Returns ABI encoding of (uint256, uint256) — two 32-byte words, 64 bytes total.
function u256word(s) {
  const x = BigInt(s);
  let h = x.toString(16);
  if (h.length > 64) throw Error("value too large for uint256");
  return h.padStart(64, "0");
}
const hex = u256word(args[0]) + u256word(args[1]);
if (hex.length !== 128) throw Error("expected 128 hex chars");
const out = new Uint8Array(64);
for (let i = 0; i < 64; i++) {
  const v = parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  if (Number.isNaN(v)) throw Error("bad hex");
  out[i] = v;
}
return out;
