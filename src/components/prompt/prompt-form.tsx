'use client';

import {useWalletUi} from '@wallet-ui/react';
import {useState, useRef} from 'react';
import {useGetBalance, useGetTokenAccounts, useTransferSol} from '../account/account-data-access';
import {address, lamportsToSol} from 'gill';
import React from 'react';
import {WalletButton} from '../solana/solana-provider';
import {Transaction, VersionedTransaction, Connection, clusterApiUrl, TransactionSignature} from '@solana/web3.js';

interface Message {
    type: 'user' | 'ai';
    content: string;
    timestamp: Date;
}

interface TransactionRequestProps {
    data: {
        destination?: string;
        amount?: number;
        transaction?: string;
        type: 'transfer' | 'swap';
        token?: string;
    };
    onSuccess: () => void;
    onCancel: () => void;
}

// Add a Phantom wallet interface
interface PhantomWallet {
    isPhantom?: boolean;
    connect: () => Promise<{publicKey: string;}>;
    disconnect: () => Promise<void>;
    signAndSendTransaction: (
        transaction: Transaction,
        options?: {skipPreflight: boolean;}
    ) => Promise<{signature: string;}>;
}

interface WindowWithPhantom extends Window {
    phantom?: {
        solana?: PhantomWallet;
    };
}

interface TransactionData {
    destination?: string;
    amount?: number;
    transaction?: string;
    type: 'transfer' | 'swap';
    token?: string;
}

interface ApiResponse {
    tool: string;
    response?: string;
    transactionData?: {
        toAddress: string;
        amount: number;
    };
    swapTransaction?: {
        transaction: string;
        token: string;
        amount: number;
    };
}

const links: string[] = [
    'List me  all the tokens I have in my wallet',
    'Give me the balance of SOL in my wallet',
    'Show me my wallet address',
    'Buy me 1 SOL of usdc token: mint EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
    'What is the price of SOL in USD?',
    'Show me a list of all the top trending tokens',
];

function TransactionRequest({data, onSuccess, onCancel}: TransactionRequestProps) {
    const {account} = useWalletUi();
    const transferSol = useTransferSol({
        address: account?.address ? address(account.address) : address('11111111111111111111111111111111'),
        account: account!
    });
    const hasExecuted = useRef(false);

    React.useEffect(() => {
        const executeTransaction = async () => {
            if (!account || hasExecuted.current) return;
            hasExecuted.current = true;

            try {
                console.log("Executing transaction", data);

                if (data.type === 'transfer' && data.destination && data.amount) {
                    // Handle SOL transfer
                    await transferSol.mutateAsync({
                        destination: address(data.destination),
                        amount: data.amount,
                    });
                    onSuccess();
                } else if (data.type === 'swap' && data.transaction) {
                    // Handle swap transaction
                    console.log("Executing swap transaction");

                    try {
                        // Get the phantom wallet from window object
                        const phantom = (window as WindowWithPhantom).phantom?.solana;

                        if (!phantom || !phantom.isPhantom) {
                            throw new Error("Phantom wallet not found");
                        }

                        console.log("Attempting to decode transaction");

                        // Establish connection to Solana cluster
                        const rpcUrl = process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl('devnet');
                        const connection = new Connection(rpcUrl, 'confirmed');

                        // Decode the base64 transaction
                        const swapTransactionBuf = Buffer.from(data.transaction, 'base64');
                        const versionedTransaction = VersionedTransaction.deserialize(swapTransactionBuf);

                        console.log("Transaction deserialized successfully:", versionedTransaction);

                        // Sign and send the transaction
                        const signature = await phantom.signAndSendTransaction(
                            versionedTransaction as any, // Cast to any to satisfy Phantom's type, which might not be updated for VersionedTransaction
                            {skipPreflight: true}
                        );

                        console.log("Swap transaction sent with signature:", signature);

                        // Confirm the transaction
                        // Get the latest blockhash and last valid block height
                        const {blockhash, lastValidBlockHeight} = await connection.getLatestBlockhash();
                        const confirmation = await connection.confirmTransaction({
                            signature: signature.signature as TransactionSignature,
                            blockhash,
                            lastValidBlockHeight
                        }, "finalized");

                        if (confirmation.value.err) {
                            throw new Error(`Transaction failed to confirm: ${JSON.stringify(confirmation.value.err)}`);
                        }

                        console.log(`Transaction successful: https://solscan.io/tx/${signature}`);
                        onSuccess();
                    } catch (error) {
                        console.error("Error sending swap transaction:", error);
                        onCancel();
                    }
                } else {
                    console.error("Invalid transaction data:", data);
                    onCancel();
                }
            } catch (error) {
                console.error('Error sending transaction:', error);
                onCancel();
            }
        };

        executeTransaction();
    }, [account, data, transferSol, onSuccess, onCancel]);

    return (
        <div className="flex justify-start">
            <div className="bg-gray-100 rounded-lg p-3">
                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
            </div>
        </div>
    );
}

export function PromptForm() {
    const [messages, setMessages] = useState<Message[]>([]);
    const [input, setInput] = useState('');
    const [conversationId, setConversationId] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [transactionData, setTransactionData] = useState<TransactionData | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const {account} = useWalletUi();
    const balance = useGetBalance({
        address: account?.address ? address(account.address) : address('11111111111111111111111111111111')
    });
    const tokenAccounts = useGetTokenAccounts({
        address: account?.address ? address(account.address) : address('11111111111111111111111111111111')
    });

    const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001/api';

    const scrollToBottom = () => {
        setTimeout(() => {
            if (chatContainerRef.current) {
                chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
            }
        }, 100);
    };

    const createConversation = async () => {
        if (conversationId) return;

        try {
            const response = await fetch(`${API_BASE_URL}/conversations`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({message: input}),
            });

            const data = await response.json();
            console.log("data", data);
            setConversationId(data.conversationId);
            addAiMessage('Hello, I am the Solana AI Assistant. How can I help you today?');
        } catch (error) {
            console.error('Error creating conversation:', error);
        }
    };

    const handlePresetMessage = (message: string) => {
        setInput(message);
        scrollToBottom();
    };

    const addUserMessage = (content: string) => {
        setMessages(prev => [...prev, {
            type: 'user',
            content,
            timestamp: new Date()
        }]);
    };

    const addAiMessage = (content: string) => {
        setMessages(prev => [...prev, {
            type: 'ai',
            content,
            timestamp: new Date()
        }]);
    };

    const handleError = (errorMessage: string = 'Sorry, there was an error processing your request. Please try again.') => {
        addAiMessage(errorMessage);
        setIsLoading(false);
        scrollToBottom();
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim()) return;

        addUserMessage(input);

        console.log("Conversation ID", conversationId, account);

        try {
            // Add AI response
            await sendMessage(input);
            setInput('');
        } catch (error) {
            console.error('Error:', error);
            handleError();
        } finally {
            setIsLoading(false);
            scrollToBottom();
        }
    };

    const handleSolanaBalance = () => {
        const sol = balance.data ? `${lamportsToSol(balance.data)} SOL` : '0 SOL';
        addAiMessage(`Your balance is ${sol}`);
    };

    const handleSendSolanaTransaction = (response: ApiResponse) => {
        if (!response.transactionData) return;

        const sol = lamportsToSol(response.transactionData.amount);
        const destination = response.transactionData.toAddress;

        setTransactionData({
            destination: response.transactionData.toAddress,
            amount: response.transactionData.amount,
            type: 'transfer'
        });

        addAiMessage(`I'll help you send ${sol} SOL to ${destination}. Please confirm the transaction.`);
    };

    const handleBuyToken = (response: ApiResponse) => {
        console.log("Buy token response:", response);

        if (response.swapTransaction) {
            setTransactionData({
                transaction: response.swapTransaction.transaction,
                type: 'swap',
                token: response.swapTransaction.token,
                amount: response.swapTransaction.amount
            });

            addAiMessage(`I'll help you buy ${response.swapTransaction.amount} of ${response.swapTransaction.token}. Please confirm the swap transaction.`);
        } else {
            addAiMessage(response.response || 'Unable to process buy token request');
        }
    };

    const handleListTokens = () => {
        console.log("List my tokens", tokenAccounts);
        if (tokenAccounts.data) {
            const tokenList = tokenAccounts.data.map(({account}) => ({
                mint: account.data.parsed.info.mint,
                balance: account.data.parsed.info.tokenAmount.uiAmount,
                decimals: account.data.parsed.info.tokenAmount.decimals,
            }));

            console.log("Token list", tokenList);
            if (tokenList.length > 0) {
                const formattedTokens = tokenList.map(token =>
                    `Token: ${token.mint}\nBalance: ${token.balance}\nDecimals: ${token.decimals}\n`
                ).join('\n');

                addAiMessage(`Here are your tokens:\n\n${formattedTokens}`);
            } else {
                addAiMessage('You don\'t have any tokens in your wallet.');
            }
        }
    };

    const processResponse = (response: ApiResponse) => {
        if (response.tool === 'get_solana_balance' && account?.address) {
            handleSolanaBalance();
        } else if (response.tool === 'send_solana_transaction') {
            handleSendSolanaTransaction(response);
        } else if (response.tool === 'buy_token') {
            handleBuyToken(response);
        } else if (response.tool === 'list_my_tokens') {
            handleListTokens();
        } else {
            console.log("Other tool", response);
            addAiMessage(response.response || 'No response available');
        }
    };

    const sendMessage = async (message: string): Promise<void> => {
        try {
            if (!conversationId) {
                throw new Error('No active conversation');
            }

            setIsLoading(true);
            const response = await (await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    walletAddress: account?.address.toString() || null,
                }),
            })).json();

            setIsLoading(false);
            processResponse(response);
            scrollToBottom();
        } catch (error) {
            console.error('Error sending message:', error);
            handleError();
        }
    };


    return (
        <div className="w-full max-w-2xl mx-auto p-4 border rounded-lg shadow-sm">
            {!conversationId || !account ?
                <div className='flex flex-row gap-4 items-center align-center mb-4'>
                    <button className={`text-white px-4 py-2 rounded-lg  ${!account ? 'cursor-not-allowed bg-black-500' : 'cursor-pointer bg-green-500'}`} onClick={() => createConversation()} disabled={!account}>Create Conversation</button>
                    <WalletButton />
                </div> :
                <div>
                    <div
                        ref={chatContainerRef}
                        className="h-[400px] overflow-y-auto mb-4 space-y-4"
                    >
                        {messages.map((message, index) => (
                            <div
                                key={index}
                                className={`flex ${message.type === 'user' ? 'justify-end' : 'justify-start'
                                    }`}
                            >
                                <div
                                    className={`max-w-[80%] rounded-lg p-3 ${message.type === 'user'
                                        ? 'bg-gray-300 text-black'
                                        : 'bg-green-700 text-white'
                                        }`}
                                >
                                    {message.content}
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-green-700 rounded-lg p-3 flex flex-row gap-2 items-center">
                                    Processing...<div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full" />
                                </div>
                            </div>
                        )}
                        {transactionData && <TransactionRequest data={transactionData} onSuccess={() => setTransactionData(null)} onCancel={() => setTransactionData(null)} />}
                    </div>
                    <form onSubmit={handleSubmit} className="flex gap-2">
                        <textarea
                            value={input}
                            onChange={(e) => setInput(e.target.value)}
                            placeholder="Type your message..."
                            className={`flex-1 p-2 border rounded-lg resize-none ${isLoading || !account ? 'cursor-not-allowed' : ''}`}
                            disabled={isLoading || !account}
                            rows={3}
                        />
                        <button
                            type="submit"
                            disabled={isLoading}
                            className={`px-4 py-2 bg-gray-300 text-black rounded-lg cursor-pointer ${isLoading ? 'cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                            {isLoading ? 'Sending...' : 'Send'}
                        </button>
                    </form>

                    <div className="max-w-xl mx-auto py-6 sm:px-6 lg:px-8">
                        <div className="space-y-2">
                            <p className='text-lg text-blue-500'>Here are some helpful messages to send to the AI assistant to get you started.</p>
                            {links.map((link, index) => (
                                <div key={index} className='cursor-pointer hover:text-blue-500' onClick={() => handlePresetMessage(link)}>
                                    {link}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            }
        </div>
    );
}
