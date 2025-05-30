'use client';

import dynamic from 'next/dynamic';
import {ReactNode} from 'react';
import {createSolanaDevnet, createSolanaLocalnet, createWalletUiConfig, WalletUi} from '@wallet-ui/react';
import '@wallet-ui/tailwind/index.css';

export const WalletButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiDropdown, {
  ssr: false,
});
export const ClusterButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiClusterDropdown, {
  ssr: false,
});

// Simple toggle: set to false to use standard mainnet (avoids WebSocket issues)
// set to true to use your custom Alchemy RPC (may show WebSocket warnings but should still work)

const privateRpcUrl = "https://solana-mainnet.g.alchemy.com/v2/46iv9grzfRX6T-Pgy7zCizHwy5jpmlmM";

const clusters = [
  createSolanaDevnet(),
  createSolanaLocalnet(),
  // createSolanaMainnet(),
];

// Add mainnet configuration based on the toggle
if (privateRpcUrl) {
  console.log('Using custom Alchemy RPC for mainnet');
  const customCluster: import('@wallet-ui/react').SolanaCluster = {
    id: 'solana:mainnet',
    label: 'Mainnet (Alchemy)',
    urlOrMoniker: privateRpcUrl,
    cluster: 'mainnet',
  };
  clusters.push(customCluster);
}

const config = createWalletUiConfig({
  clusters,
});

export function SolanaProvider({children}: {children: ReactNode;}) {
  return (
    <WalletUi config={config}>
      {children}
    </WalletUi>
  );
}