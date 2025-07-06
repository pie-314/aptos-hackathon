"use client";

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Mail, Lock, Wallet, Eye, EyeOff, AlertCircle, CheckCircle } from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: (user: any, authMethod: 'email' | 'wallet') => void;
}

interface PetraWindow extends Window {
  aptos?: {
    connect: () => Promise<{ address: string; publicKey: string }>;
    account: () => Promise<{ address: string; publicKey: string }>;
    isConnected: () => Promise<boolean>;
    disconnect: () => Promise<void>;
    signAndSubmitTransaction: (transaction: any) => Promise<any>;
    signTransaction: (transaction: any) => Promise<any>;
    signMessage: (message: any) => Promise<any>;
    network: () => Promise<string>;
    onNetworkChange: (listener: (network: string) => void) => void;
    onAccountChange: (listener: (account: any) => void) => void;
  };
}

declare const window: PetraWindow;

const AuthModal: React.FC<AuthModalProps> = ({ isOpen, onClose, onSuccess }) => {
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authMethod, setAuthMethod] = useState<'email' | 'wallet'>('email');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState<string>('');
  const [walletAddress, setWalletAddress] = useState<string>('');

  const supabase = createClientComponentClient();

  // Reset form when modal opens/closes
  useEffect(() => {
    if (isOpen) {
      setEmail('');
      setPassword('');
      setConfirmPassword('');
      setError('');
      setSuccess('');
      setWalletAddress('');
    }
  }, [isOpen]);

  // Check if Petra wallet is installed
  const isPetraInstalled = () => {
    return typeof window !== 'undefined' && window.aptos;
  };

  // Handle email/password authentication
  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (authMode === 'signup') {
        // Validate password confirmation
        if (password !== confirmPassword) {
          throw new Error('Passwords do not match');
        }

        if (password.length < 6) {
          throw new Error('Password must be at least 6 characters long');
        }

        // Sign up user
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        });

        if (error) throw error;

        if (data.user) {
          // Insert user data into custom users table with initial tokens
          const { error: insertError } = await supabase
            .from('users')
            .insert([
              {
                id: data.user.id,
                email: data.user.email,
                auth_method: 'email',
                wallet_address: null,
                token: '100', // Initial token count for new users
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString(),
              },
            ]);

          if (insertError) {
            console.warn('Failed to insert user data:', insertError);
          }

          setSuccess('Account created successfully! Please check your email to verify your account.');
        }
      } else {
        // Sign in user
        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        if (data.user) {
          setSuccess('Login successful!');
          onSuccess?.(data.user, 'email');
          setTimeout(() => {
            onClose();
          }, 1000);
        }
      }
    } catch (err: any) {
      setError(err.message || 'An error occurred during authentication');
    } finally {
      setLoading(false);
    }
  };

  // Handle Petra wallet connection
  const handleWalletAuth = async () => {
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      if (!isPetraInstalled()) {
        throw new Error('Petra wallet is not installed. Please install it from the Chrome Web Store.');
      }

      // Connect to Petra wallet
      const response = await window.aptos!.connect();
      const { address } = response;
      setWalletAddress(address);

      // Check if user exists in database
      const { data: existingUser, error: fetchError } = await supabase
        .from('users')
        .select('*')
        .eq('wallet_address', address)
        .single();

      if (fetchError && fetchError.code !== 'PGRST116') {
        throw fetchError;
      }

      let userData;

      if (existingUser) {
        // User exists, update last login
        const { data: updatedUser, error: updateError } = await supabase
          .from('users')
          .update({ 
            updated_at: new Date().toISOString() 
          })
          .eq('wallet_address', address)
          .select()
          .single();

        if (updateError) throw updateError;
        userData = updatedUser;
      } else {
        // Create new user with initial tokens
        const { data: newUser, error: insertError } = await supabase
          .from('users')
          .insert([
            {
              email: null,
              auth_method: 'wallet',
              wallet_address: address,
              token: '100', // Initial token count for new wallet users
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            },
          ])
          .select()
          .single();

        if (insertError) throw insertError;
        userData = newUser;
      }

      // Store wallet connection in localStorage
      localStorage.setItem('walletAddress', address);
      localStorage.setItem('isWalletConnected', 'true');

      setSuccess('Wallet connected successfully!');
      onSuccess?.(userData, 'wallet');
      
      setTimeout(() => {
        onClose();
      }, 1000);

    } catch (err: any) {
      setError(err.message || 'Failed to connect wallet');
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('isWalletConnected');
    } finally {
      setLoading(false);
    }
  };

  // Handle disconnect wallet
  const handleDisconnectWallet = async () => {
    try {
      if (isPetraInstalled()) {
        await window.aptos!.disconnect();
      }
      localStorage.removeItem('walletAddress');
      localStorage.removeItem('isWalletConnected');
      setWalletAddress('');
      setSuccess('Wallet disconnected successfully');
    } catch (err: any) {
      setError('Failed to disconnect wallet');
    }
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
        onClick={onClose}
      >
        <motion.div
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 0 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-slate-900 rounded-2xl border border-white/10 w-full max-w-md overflow-hidden"
        >
          {/* Header */}
          <div className="px-6 py-4 border-b border-white/10 flex items-center justify-between">
            <h2 className="text-xl font-bold text-white">
              {authMode === 'login' ? 'Sign In' : 'Create Account'}
            </h2>
            <button
              onClick={onClose}
              className="text-white/60 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-6">
            {/* Auth Method Toggle */}
            <div className="flex space-x-2 mb-6">
              <button
                onClick={() => setAuthMethod('email')}
                className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                  authMethod === 'email'
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                <Mail size={16} className="inline mr-2" />
                Email
              </button>
              <button
                onClick={() => setAuthMethod('wallet')}
                className={`flex-1 py-3 px-4 rounded-lg border transition-all ${
                  authMethod === 'wallet'
                    ? 'bg-purple-600 border-purple-600 text-white'
                    : 'bg-white/5 border-white/10 text-white/70 hover:bg-white/10'
                }`}
              >
                <Wallet size={16} className="inline mr-2" />
                Wallet
              </button>
            </div>

            {/* Error/Success Messages */}
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-red-500/20 border border-red-500/30 rounded-lg flex items-center text-red-300"
              >
                <AlertCircle size={16} className="mr-2 flex-shrink-0" />
                <span className="text-sm">{error}</span>
              </motion.div>
            )}

            {success && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                className="mb-4 p-3 bg-green-500/20 border border-green-500/30 rounded-lg flex items-center text-green-300"
              >
                <CheckCircle size={16} className="mr-2 flex-shrink-0" />
                <span className="text-sm">{success}</span>
              </motion.div>
            )}

            {/* Email Authentication */}
            {authMethod === 'email' && (
              <form onSubmit={handleEmailAuth} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      placeholder="Enter your email"
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-white/80 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                      placeholder="Enter your password"
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
                    >
                      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                {authMode === 'signup' && (
                  <div>
                    <label className="block text-sm font-medium text-white/80 mb-2">
                      Confirm Password
                    </label>
                    <div className="relative">
                      <Lock size={16} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/40" />
                      <input
                        type={showConfirmPassword ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-lg text-white placeholder-white/40 focus:border-purple-500 focus:ring-1 focus:ring-purple-500 outline-none transition-all"
                        placeholder="Confirm your password"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-white/40 hover:text-white/60"
                      >
                        {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <div className="flex items-center justify-center">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                      Processing...
                    </div>
                  ) : (
                    authMode === 'login' ? 'Sign In' : 'Create Account'
                  )}
                </button>

                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
                    className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                  >
                    {authMode === 'login' 
                      ? "Don't have an account? Sign up" 
                      : "Already have an account? Sign in"
                    }
                  </button>
                </div>
              </form>
            )}

            {/* Wallet Authentication */}
            {authMethod === 'wallet' && (
              <div className="space-y-4">
                {!walletAddress ? (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-gradient-to-r from-purple-600 to-blue-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <Wallet size={24} className="text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Connect Your Petra Wallet
                    </h3>
                    <p className="text-white/60 text-sm mb-6">
                      Connect your Petra wallet to access your account securely on the Aptos blockchain.
                    </p>
                    
                    {!isPetraInstalled() && (
                      <div className="mb-4 p-3 bg-orange-500/20 border border-orange-500/30 rounded-lg">
                        <p className="text-orange-300 text-sm">
                          Petra wallet is not installed. Please install it from the Chrome Web Store first.
                        </p>
                      </div>
                    )}
                    
                    <button
                      onClick={handleWalletAuth}
                      disabled={loading || !isPetraInstalled()}
                      className="w-full py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {loading ? (
                        <div className="flex items-center justify-center">
                          <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin mr-2" />
                          Connecting...
                        </div>
                      ) : (
                        'Connect Petra Wallet'
                      )}
                    </button>
                  </div>
                ) : (
                  <div className="text-center">
                    <div className="w-16 h-16 bg-green-600 rounded-full flex items-center justify-center mx-auto mb-4">
                      <CheckCircle size={24} className="text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">
                      Wallet Connected
                    </h3>
                    <p className="text-white/60 text-sm mb-2">
                      Address: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
                    </p>
                    <button
                      onClick={handleDisconnectWallet}
                      className="text-red-400 hover:text-red-300 text-sm transition-colors"
                    >
                      Disconnect Wallet
                    </button>
                  </div>
                )}
              </div>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};

export default AuthModal;
