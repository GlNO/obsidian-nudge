import { parseLine } from "./parser";

const samples = [
  "- [ ] Call Sam @2026-10-05 14:30",
"- [ ] Short date @2026-10-5",
"- [x] Done one @2026-10-02 done:2026-10-01",
"- [ ] Bad date @2026-13-45",
"- [ ] Email bob@2026-10-05",
"- [ ] No date",
];

samples.forEach((s, i) => console.log(parseLine(s, "test.md", i)));