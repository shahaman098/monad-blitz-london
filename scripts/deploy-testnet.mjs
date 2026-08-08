import { spawnSync } from 'node:child_process'
import { envValue, loadRootEnv } from './load-root-env.mjs'

loadRootEnv()

const check = spawnSync('node', ['scripts/check-env.mjs'], {
  cwd: process.cwd(),
  env: process.env,
  stdio: 'inherit',
})

if (check.status !== 0) {
  process.exit(check.status ?? 1)
}

const rpcUrl = envValue('MONAD_RPC_URL')
const child = spawnSync(
  'forge',
  [
    'script',
    'contracts/script/DeployClutch.s.sol:DeployClutchScript',
    '--root',
    'contracts',
    '--rpc-url',
    rpcUrl,
    '--broadcast',
  ],
  {
    cwd: process.cwd(),
    env: process.env,
    stdio: 'inherit',
  }
)

process.exit(child.status ?? 1)
