'use client';

import dynamic from 'next/dynamic';
import {ReactNode} from 'react';
import {createSolanaDevnet, createSolanaLocalnet, createSolanaMainnet, createWalletUiConfig, SolanaCluster, WalletUi} from '@wallet-ui/react';
import '@wallet-ui/tailwind/index.css';

export const WalletButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiDropdown, {
  ssr: false,
});
export const ClusterButton = dynamic(async () => (await import('@wallet-ui/react')).WalletUiClusterDropdown, {
  ssr: false,
});
const privateRpcUrl = "https://solana-mainnet.g.alchemy.com/v2/46iv9grzfRX6T-Pgy7zCizHwy5jpmlmM";

const clusters = [
  createSolanaDevnet(),
  createSolanaLocalnet(),
  createSolanaMainnet(),
];

if (privateRpcUrl) {
  console.log('privateRpcUrl', privateRpcUrl);
  const customCluster: SolanaCluster = {
    id: `solana:${privateRpcUrl}`,
    label: 'Private RPC',
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