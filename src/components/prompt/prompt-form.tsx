'use client';

import {useWalletUi} from '@wallet-ui/react';
import {useState, useRef} from 'react';
import {useGetBalance, useTransferSol} from '../account/account-data-access';
import {address, lamportsToSol} from 'gill';
import React from 'react';

interface Message {
    type: 'user' | 'ai';
    content: string;
    timestamp: Date;
}

interface TransactionRequestProps {
    data: {
        destination: string;
        amount: number;
    };
    onSuccess: () => void;
    onCancel: () => void;
}

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
                await transferSol.mutateAsync({
                    destination: address(data.destination),
                    amount: data.amount,
                });
                onSuccess();
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
    const [transactionData, setTransactionData] = useState<{destination: string; amount: number;} | null>(null);
    const chatContainerRef = useRef<HTMLDivElement>(null);

    const {account} = useWalletUi();
    const balance = useGetBalance({
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
            setMessages(prev => [...prev, {
                type: 'ai',
                content: 'Hello, I am the Solana AI Assistant. How can I help you today?',
                timestamp: new Date()
            }]);
        } catch (error) {
            console.error('Error creating conversation:', error);

        }
    };

    const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        if (!input.trim()) return;

        setMessages(prev => [...prev, {
            type: 'user',
            content: input,
            timestamp: new Date()
        }]);

        console.log("Conversation ID", conversationId, account);

        try {
            // Add AI response
            await sendMessage(input);

            setInput('');
        } catch (error) {
            console.error('Error:', error);
            setMessages(prev => [...prev, {
                type: 'ai',
                content: 'Sorry, there was an error processing your request. Please try again.',
                timestamp: new Date()
            }]);
        } finally {
            setIsLoading(false);
            scrollToBottom();
        }
    };

    const sendMessage = async (message: string): Promise<void> => {
        try {
            if (!conversationId) {
                throw new Error('No active conversation');
            }

            const response = await fetch(`${API_BASE_URL}/conversations/${conversationId}/messages`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message,
                    walletAddress: account?.address.toString() || null,
                }),
            });

            const data = await response.json();

            if (data.tool === 'get_solana_balance' && account?.address) {
                const sol = balance.data ? `${lamportsToSol(balance.data)} SOL` : '0 SOL';

                setMessages(prev => [
                    ...prev,
                    {
                        type: 'ai',
                        content: `Your balance is ${sol}`,
                        timestamp: new Date(),
                    },
                ]);

            } else if (data.tool === 'send_solana_transaction') {
                console.log("Transaction data", data);
                const sol = lamportsToSol(data.transactionData.amount);
                const destination = data.transactionData.toAddress;

                setTransactionData({
                    destination: data.transactionData.toAddress,
                    amount: data.transactionData.amount
                });

                setMessages(prev => [
                    ...prev,
                    {
                        type: 'ai',
                        content: `I'll help you send ${sol} SOL to ${destination}. Please confirm the transaction.`,
                        timestamp: new Date(),
                    },
                ]);
            } else {
                setMessages(prev => [
                    ...prev,
                    {
                        type: 'ai',
                        content: data.response,
                        timestamp: new Date(),
                    },
                ]);
            }

            setIsLoading(false);
            scrollToBottom();
        } catch (error) {
            console.error('Error sending message:', error);
            setIsLoading(false);

            setMessages(prev => [
                ...prev,
                {
                    type: 'ai',
                    content: 'Sorry, there was an error processing your request. Please try again.',
                    timestamp: new Date(),
                },
            ]);

            scrollToBottom();
        }
    };

    return (
        <div className="w-full max-w-2xl mx-auto p-4 border rounded-lg shadow-sm">
            {!conversationId ? <div>
                <button onClick={() => createConversation()}>Create Conversation</button>
            </div> :
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
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-gray-100 dark:bg-neutral-800'
                                    }`}
                            >
                                {message.content}
                            </div>
                        </div>
                    ))}
                    {isLoading && (
                        <div className="flex justify-start">
                            <div className="bg-gray-100 rounded-lg p-3">
                                <div className="animate-spin h-4 w-4 border-2 border-blue-500 border-t-transparent rounded-full" />
                            </div>
                        </div>
                    )}
                    {transactionData && <TransactionRequest data={transactionData} onSuccess={() => setTransactionData(null)} onCancel={() => setTransactionData(null)} />}
                </div>
            }

            <form onSubmit={handleSubmit} className="flex gap-2">
                <textarea
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    placeholder="Type your message..."
                    className="flex-1 p-2 border rounded-lg resize-none"
                    disabled={isLoading}
                    rows={3}
                />
                <button
                    type="submit"
                    disabled={isLoading}
                    className="px-4 py-2 bg-blue-500 text-white rounded-lg disabled:opacity-50"
                >
                    {isLoading ? 'Sending...' : 'Send'}
                </button>
            </form>
        </div>
    );
}
