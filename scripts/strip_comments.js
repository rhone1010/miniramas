/* strip_comments.js — CUI V24, 2026-07-31

   Blanks every comment in a script block and prints the result.

   WHY THIS EXISTS. The gates hand-rolled a stripper that tracked quotes
   character by character. It did not know a regex literal from a division,
   so `.replace(/"/g, '&quot;')` inside esc() read as the start of a string
   that never closed, and everything after line 1525 of the stage was
   garbage. Assertions kept passing because they were searching nonsense.

   A parser knows. Comments are blanked rather than deleted so every byte
   offset and line number in the output still matches the input — a gate
   that reports a position should report the real one. */

const fs = require('fs');
const acorn = require('acorn');

const code = fs.readFileSync(process.argv[2], 'utf8');
const comments = [];

try {
  acorn.parse(code, { ecmaVersion: 2022, onComment: comments });
} catch (e) {
  process.stderr.write('PARSE FAIL: ' + e.message + '\n');
  process.exit(2);
}

const out = code.split('');
for (const c of comments) {
  for (let i = c.start; i < c.end; i++) {
    if (out[i] !== '\n') out[i] = ' ';
  }
}
process.stdout.write(out.join(''));
