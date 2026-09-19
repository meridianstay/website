import { randomInt } from 'node:crypto'

// No 0/O or 1/I so codes are easy to read out over the phone.
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

export function newBookingCode(): string {
  let code = 'MS-'
  for (let i = 0; i < 6; i++) code += ALPHABET[randomInt(ALPHABET.length)]
  return code
}
