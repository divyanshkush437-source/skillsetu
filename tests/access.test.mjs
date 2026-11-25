import test from "node:test";
import assert from "node:assert/strict";
import { packs } from "../src/access/catalog.mjs";
import { asciiDigits } from "../src/access/digits.mjs";
import { config } from "../backend/validation.mjs";
test("Every scheduled language offers the complete guided flow and all canonical trades",()=>{
  const scheduled="as bn brx doi gu hi kn ks kok mai ml mni mr ne or pa sa sat sd ta te ur".split(" ");
  for(const code of [...scheduled,"en"]){
    assert.deepEqual(Object.keys(packs[code].t),Object.keys(packs.en.t));
    for(const trade of config.skills)assert.ok(packs[code].t[trade]);
  }
  assert.deepEqual(Object.values(packs).filter(p=>p.rtl).map(p=>p.code).sort(),["ks","sd","ur"]);
});
test("Regional phone and OTP digits preserve leading zeroes",()=>{
  for(const digits of ["०१२३४५","০১২৩৪৫","૦૧૨૩૪૫","٠١٢٣٤٥","౦౧౨౩౪౫","௦௧௨௩௪௫"])assert.equal(asciiDigits(digits),"012345");
});
