import { envValue, loadRootEnv } from './load-root-env.mjs'

loadRootEnv()

const required = [
  'VITE_MONAD_RPC_URL',
  'VITE_MONAD_CHAIN_ID',
  'MONAD_RPC_URL',
  'MONAD_CHAIN_ID',
  'PRIVATE_KEY',
  'SPONSOR_PRIVATE_KEY',
]

const missing = required.filter((name) => !envValue(name))
if (missing.length > 0) {
  console.error(`Missing required .env values: ${missing.join(', ')}`)
  process.exit(1)
}

if (envValue('MONAD_CHAIN_ID') !== '10143' || envValue('VITE_MONAD_CHAIN_ID') !== '10143') {
  console.error('Expected MONAD testnet chain id 10143 in both MONAD_CHAIN_ID and VITE_MONAD_CHAIN_ID')
  process.exit(1)
}

if (!envValue('MONAD_RPC_URL').includes('monad')) {
  console.error('MONAD_RPC_URL does not look like a Monad endpoint')
  process.exit(1)
}

if (!envValue('VITE_MONAD_RPC_URL').includes('monad')) {
  console.error('VITE_MONAD_RPC_URL does not look like a Monad endpoint')
  process.exit(1)
}

if (envValue('PRIVATE_KEY') === envValue('SPONSOR_PRIVATE_KEY')) {
  console.error('PRIVATE_KEY and SPONSOR_PRIVATE_KEY must be different wallets')
  process.exit(1)
}

for (const keyName of ['PRIVATE_KEY', 'SPONSOR_PRIVATE_KEY']) {
  const value = envValue(keyName)
  if (!/^0x[0-9a-fA-F]{64}$/.test(value)) {
    console.error(`${keyName} is not a valid 32-byte hex private key`)
    process.exit(1)
  }
}

console.log('Environment looks ready for Monad testnet deploy.')
