import { readFileSync, writeFileSync } from 'node:fs'
const art = JSON.parse(readFileSync('contracts/out/Clutch.sol/Clutch.json', 'utf8'))
writeFileSync(
  'app/src/lib/clutchAbi.ts',
  `// AUTO-GENERATED from contracts/out/Clutch.sol/Clutch.json — run \`pnpm abi\` to refresh.\nexport const clutchAbi = ${JSON.stringify(art.abi, null, 2)} as const\n`
)
console.log('wrote app/src/lib/clutchAbi.ts,', art.abi.length, 'entries')
