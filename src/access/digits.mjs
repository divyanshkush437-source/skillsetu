// Normalize digits without changing the user's keyboard or stored phone format.
export function asciiDigits(text) {
  const zeroes = [0x660,0x6f0,0x966,0x9e6,0xa66,0xae6,0xb66,0xbe6,0xc66,0xce6,0xd66,0x1c50,0xabf0];
  return Array.from(text.normalize("NFKC"), char => {
    const point = char.codePointAt(0);
    const zero = zeroes.find(base => point >= base && point < base + 10);
    return zero === undefined ? char : String(point-zero);
  }).join("");
}
