"use client";

import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import React from "react";

interface ConnectWalletModalProps {
  isOpen: boolean;
  onClose: () => void;
}

// Define proper types for Aptos wallet
interface AptosAccount {
  address: string;
  publicKey: string;
}

interface AptosTransaction {
  type: string;
  function: string;
  type_arguments: string[];
  arguments: unknown[];
}

interface AptosSignedTransaction {
  hash: string;
  [key: string]: unknown;
}

interface AptosMessage {
  message: string;
  nonce: string;
}

interface AptosSignedMessage {
  signature: string;
  [key: string]: unknown;
}

// Extend Window interface for Petra wallet
declare global {
  interface Window {
    aptos?: {
      connect: () => Promise<AptosAccount>;
      account: () => Promise<AptosAccount>;
      isConnected: () => Promise<boolean>;
      disconnect: () => Promise<void>;
      signAndSubmitTransaction: (transaction: AptosTransaction) => Promise<AptosSignedTransaction>;
      signTransaction: (transaction: AptosTransaction) => Promise<AptosSignedTransaction>;
      signMessage: (message: AptosMessage) => Promise<AptosSignedMessage>;
      network: () => Promise<string>;
      onAccountChange: (listener: (account: AptosAccount) => void) => void;
      onNetworkChange: (listener: (network: string) => void) => void;
    };
  }
}

const ConnectWalletModal: React.FC<ConnectWalletModalProps> = ({
  isOpen,
  onClose,
}) => {
  const router = useRouter();
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isCheckingRegistration, setIsCheckingRegistration] = useState(false);

  // Smart contract address - replace with your actual deployed contract address
  const CONTRACT_ADDRESS =  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const REGISTRY_ADMIN_ADDRESS = CONTRACT_ADDRESS; // Assuming admin is the contract deployer
  const DEVNET_URL = "https://fullnode.devnet.aptoslabs.com";

  const checkBrandRegistration = async (brandAddress: string): Promise<boolean> => {
    try {
      setIsCheckingRegistration(true);
      
      console.log("Checking brand registration for:", brandAddress);
      console.log("Registry admin address:", REGISTRY_ADMIN_ADDRESS);
      
      // Validate brand address format
      if (!brandAddress.startsWith('0x') || brandAddress.length !== 66) {
        console.error("Invalid brand address format");
        return false;
      }

      // Use direct fetch approach like the working example
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `${CONTRACT_ADDRESS}::BrandRegistry::is_registered`,
          type_arguments: [],
          arguments: [REGISTRY_ADMIN_ADDRESS, brandAddress]
        })
      });

      const data = await response.json();
      console.log("View function response:", data);

      if (response.ok) {
        const isRegistered = data[0]; // The function returns a boolean
        console.log("Brand registration status:", isRegistered);
        return isRegistered;
      } else {
        console.error("View function error:", data);
        // If there's an error, assume not registered
        return false;
      }
    } catch (err) {
      console.error("Error checking brand registration:", err);
      // If there's an error checking registration, assume not registered
      return false;
    } finally {
      setIsCheckingRegistration(false);
    }
  };

  const handlePetraConnect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Check if Petra wallet is installed
      if (!window.aptos) {
        setError("Petra wallet is not installed. Please install it from the Chrome Web Store.");
        return;
      }

      // Check wallet network and prompt user to switch if needed
      try {
        const currentNetwork = await window.aptos.network();
        console.log("Current wallet network:", currentNetwork);
        if (currentNetwork !== "Devnet") {
          setError("Please switch your Petra wallet to Devnet network to use this application.");
          return;
        }
      } catch (networkErr) {
        console.warn("Could not verify wallet network:", networkErr);
        // Continue with connection attempt
      }

      // Connect to Petra wallet
      const response = await window.aptos.connect();
      
      console.log("Connected to Petra wallet:", response);
      
      // Store wallet info in localStorage
      localStorage.setItem('walletAddress', response.address);
      localStorage.setItem('walletPublicKey', response.publicKey);
      localStorage.setItem('isWalletConnected', 'true');
      
      // Check if the connected address is a registered brand
      const isRegistered = await checkBrandRegistration(response.address);
      
      console.log("Brand registration status:", isRegistered);
      
      // Close modal first
      onClose();
      
      // Route based on registration status
      if (isRegistered) {
        // Brand is registered, go to dashboard
        router.push('/dashboard');
      } else {
        // Brand is not registered, go to registration page
        router.push('/brand/register/new');
      }
      
    } catch (err: unknown) {
      console.error("Error connecting to Petra wallet:", err);
      
      // Handle specific error cases
      if (err && typeof err === 'object' && 'code' in err && err.code === 4001) {
        setError("Connection rejected by user.");
      } else if (err instanceof Error && err.message?.includes("User rejected")) {
        setError("Connection rejected by user.");
      } else {
        setError("Failed to connect to Petra wallet. Please try again.");
      }
    } finally {
      setIsConnecting(false);
      setIsCheckingRegistration(false);
    }
  };

  const checkWalletConnection = async () => {
    try {
      if (window.aptos) {
        const isConnected = await window.aptos.isConnected();
        if (isConnected) {
          // Check network first
          try {
            const currentNetwork = await window.aptos.network();
            console.log("Already connected wallet network:", currentNetwork);
            if (currentNetwork !== "Devnet") {
              setError("Please switch your Petra wallet to Devnet network to use this application.");
              return;
            }
          } catch (networkErr) {
            console.warn("Could not verify wallet network:", networkErr);
          }

          const account = await window.aptos.account();
          console.log("Already connected account:", account);
          
          localStorage.setItem('walletAddress', account.address);
          localStorage.setItem('walletPublicKey', account.publicKey);
          localStorage.setItem('isWalletConnected', 'true');
          
          // Check registration status for already connected wallet
          const isRegistered = await checkBrandRegistration(account.address);
          
          onClose();
          
          if (isRegistered) {
            router.push('/dashboard');
          } else {
            router.push('/brand/register/new');
          }
        }
      }
    } catch (err) {
      console.error("Error checking wallet connection:", err);
    }
  };

  // Check if wallet is already connected when modal opens
  React.useEffect(() => {
    if (isOpen) {
      checkWalletConnection();
    }
  }, [isOpen]);

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[200]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />

          {/* Modal */}
          <motion.div
            className="fixed inset-0 z-[201] flex items-center justify-center p-4"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", duration: 0.5 }}
          >
            <div className="bg-slate-900/95 backdrop-blur-xl border border-white/10 rounded-2xl p-8 max-w-md w-full shadow-2xl">
              {/* Header */}
              <div className="flex items-center justify-between mb-8">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-2">
                    Connect Wallet
                  </h2>
                  <p className="text-white/70 text-sm">
                    Connect your Aptos wallet to get started
                  </p>
                </div>
                <button
                  onClick={onClose}
                  className="text-white/70 hover:text-white transition-colors p-2 hover:bg-white/10 rounded-lg"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Error Display */}
              {error && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl">
                  <p className="text-red-400 text-sm">{error}</p>
                </div>
              )}

              {/* Loading State for Registration Check */}
              {isCheckingRegistration && (
                <div className="mb-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
                  <div className="flex items-center space-x-3">
                    <div className="w-5 h-5 border-2 border-blue-400/30 border-t-blue-400 rounded-full animate-spin" />
                    <p className="text-blue-400 text-sm">Checking brand registration status...</p>
                  </div>
                </div>
              )}

              {/* Petra Wallet Option */}
              <motion.button
                onClick={handlePetraConnect}
                disabled={isConnecting || isCheckingRegistration}
                className={`w-full flex items-center justify-between p-4 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-white/20 rounded-xl transition-all duration-300 group ${
                  isConnecting || isCheckingRegistration ? 'opacity-50 cursor-not-allowed' : ''
                }`}
                whileHover={!isConnecting && !isCheckingRegistration ? { scale: 1.02 } : {}}
                whileTap={!isConnecting && !isCheckingRegistration ? { scale: 0.98 } : {}}
              >
                <div className="flex items-center space-x-4">
                  <div className="w-12 h-12 bg-gradient-to-r from-orange-500 to-red-500 rounded-xl flex items-center justify-center">
                    {isConnecting || isCheckingRegistration ? (
                      <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    ) : (
                      <Image
                        src="/petra.png"
                        alt="Petra Wallet"
                        width={32}
                        height={32}
                      />
                    )}
                  </div>
                  <div className="text-left">
                    <h3 className="text-white font-semibold">
                      {isConnecting 
                        ? 'Connecting...' 
                        : isCheckingRegistration 
                        ? 'Checking Registration...'
                        : 'Petra Wallet'
                      }
                    </h3>
                    <p className="text-white/60 text-sm">
                      {isConnecting 
                        ? 'Please check your wallet' 
                        : isCheckingRegistration
                        ? 'Verifying brand status on blockchain'
                        : 'Connect using Petra Aptos Wallet'
                      }
                    </p>
                  </div>
                </div>
                {!isConnecting && !isCheckingRegistration && (
                  <svg
                    className="w-5 h-5 text-white/40 group-hover:text-white/70 transition-colors"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5l7 7-7 7"
                    />
                  </svg>
                )}
              </motion.button>

              {/* Install Petra Link */}
              {error?.includes("not installed") && (
                <div className="mt-4 text-center">
                  <a
                    href="https://petra.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-400 hover:text-blue-300 transition-colors text-sm underline"
                  >
                    Install Petra Wallet
                  </a>
                </div>
              )}

              {/* Info about registration check */}
              <div className="mt-6 p-4 bg-white/5 rounded-xl">
                <p className="text-white/70 text-xs text-center">
                  We&apos;ll automatically check if your wallet is registered as a brand on TraceChain and redirect you accordingly.
                </p>
              </div>

              {/* Footer */}
              <div className="mt-8 text-center">
                <p className="text-white/50 text-sm">
                  By connecting your wallet, you agree to our{" "}
                  <a
                    href="#terms"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Terms of Service
                  </a>{" "}
                  and{" "}
                  <a
                    href="#privacy"
                    className="text-blue-400 hover:text-blue-300 transition-colors"
                  >
                    Privacy Policy
                  </a>
                </p>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};

export default ConnectWalletModal;