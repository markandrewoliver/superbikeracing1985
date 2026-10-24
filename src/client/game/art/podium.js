// Front-facing heads for the podium.

export const FRONT_HEADS = {"prof": ["...jjj...", ".hjiiijh.", ".heaeaeh.", ".fiiiiif.", "..fffff..", "...fff..."], "helmet": ["..ffrff..", ".fffrfff.", ".heeeegh.", ".heeeeeh.", "..hfffh.."], "short": ["..fffff..", ".fffffff.", ".ffiiiff.", ".jieieij.", "..iiiii.."], "long": ["..fffff..", ".fffffff.", ".ffiiiff.", ".fieieif.", ".fiiiiif.", ".ff...ff."], "bald": ["...jjj...", "..jiiij..", ".jiiiiij.", ".jieieij.", "..iiiii.."], "clown": ["....f....", "...fhf...", "ffcccccff", "hfcececfh", ".fccnccf.", "..cnnnc.."], "skull": [".f.fhf.f.", "fhfhohfhf", "hoacccaoh", "hacccccah", "haeeceeah", "haccdccah", ".hcgcgch."], "goggles": ["..ffrff..", ".fffrfff.", "fdaadaadf", ".hiiiiih.", "..diiid.."], "mx": [".ffrrrff.", "fffffffff", ".daadaad.", ".hiiiiih.", "..hiiih.."], "bobby": ["....f....", "...fff...", "..fffff..", "..ffaff..", "..fffff..", ".hhhhhhh.", ".jieieij.", "..iiiii..", "..diiid.."], "cap": ["..fffff..", ".fffofff.", ".hhhhhhh.", ".jeeeeej.", "..iiiii.."], "brodie": ["...fff...", "..fffff..", "hhhhhhhhh", ".jieieij.", "..iiiii..", "..diiid.."]};
// The Workshop's three new heads (section 7), in the same 9-wide format.
Object.assign(FRONT_HEADS, {
  stache3: ['..fffff..', '.fffffff.', '.ffiiiff.', '.jieieij.', '.jfffffj.', '.jfiiifj.', '..fiiif..'],
  flag_us: ['..uuuuu..', '.ufuufuu.', '.XeeeegX.', '.feeeeef.', '..XfXfX..'],
  prof2: ['...jjj...', '.hjiiijh.', '.heaeaeh.', '..iijii..', '..fffff..', '.fffhfff.', '.fffffff.']   // the tutorial professor's own head (beard in HAIR COLOR, tufts and mouth in its shade)
});
// Rows of a head that hang down OVER the body on the podium (a long beard): drawn after the body and arms, from the
// body's top row down.
export const FRONT_OVER = { prof2: ['...fff...', '....f....'] };
