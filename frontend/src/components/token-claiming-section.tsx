import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Coins, 
  Gift, 
  Clock, 
  CheckCircle, 
  Download,
  Sparkles,
  Trophy,
  Star,
  X
} from 'lucide-react';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import confetti from 'canvas-confetti';

interface Product {
  brandVerified: boolean;
}

interface TokenClaimingSectionProps {
  product: Product;
  userTokens?: number;
  onClaimTokens?: (tokens: number) => void;
}

const TokenClaimingSection: React.FC<TokenClaimingSectionProps> = ({ product, userTokens = 100, onClaimTokens }) => {
  const [isClaiming, setIsClaiming] = useState(false);
  const [isClaimed, setIsClaimed] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [claimedAmount, setClaimedAmount] = useState(0);
  
  const supabase = createClientComponentClient();
  
  // Calculate reward tokens based on product verification
  const baseReward = 50;
  const bonusReward = product.brandVerified ? 25 : 0;
  const totalReward = baseReward + bonusReward;
  
  // Function to trigger confetti animation
  const triggerConfetti = () => {
    // Multiple bursts for more impressive effect
    const count = 200;
    const defaults = {
      origin: { y: 0.7 }
    };

    function fire(particleRatio: number, opts: any) {
      confetti({
        ...defaults,
        ...opts,
        particleCount: Math.floor(count * particleRatio)
      });
    }

    // Colorful burst
    fire(0.25, {
      spread: 26,
      startVelocity: 55,
      colors: ['#ff6b9d', '#c44569', '#f8b500', '#feca57']
    });

    fire(0.2, {
      spread: 60,
      colors: ['#a55eea', '#26de81', '#fd79a8', '#fdcb6e']
    });

    fire(0.35, {
      spread: 100,
      decay: 0.91,
      scalar: 0.8,
      colors: ['#6c5ce7', '#74b9ff', '#00cec9', '#55a3ff']
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 25,
      decay: 0.92,
      scalar: 1.2,
      colors: ['#ff7675', '#74b9ff', '#00b894', '#fdcb6e']
    });

    fire(0.1, {
      spread: 120,
      startVelocity: 45,
      colors: ['#e84393', '#00cec9', '#6c5ce7', '#ffeaa7']
    });
  };

  const updateTokensInSupabase = async (tokensToAdd: number): Promise<boolean> => {
    try {
      // Check wallet connection first
      const walletAddress = localStorage.getItem('walletAddress');
      const isWalletConnected = localStorage.getItem('isWalletConnected') === 'true';

      let userId = null;
      let currentTokens = 0;

      if (walletAddress && isWalletConnected) {
        // User connected via wallet
        const { data: user, error: fetchError } = await supabase
          .from('users')
          .select('*')
          .eq('wallet_address', walletAddress)
          .single();

        if (user && !fetchError) {
          userId = user.id;
          currentTokens = parseInt(user.token) || 0;
        }
      } else {
        // Check Supabase session for email auth
        const { data: { session } } = await supabase.auth.getSession();
        
        if (session?.user) {
          const { data: user, error: fetchError } = await supabase
            .from('users')
            .select('*')
            .eq('id', session.user.id)
            .single();

          if (user && !fetchError) {
            userId = user.id;
            currentTokens = parseInt(user.token) || 0;
          }
        }
      }

      if (!userId) {
        throw new Error('User not found or not authenticated');
      }

      // Update tokens in database
      const newTokenCount = currentTokens + tokensToAdd;
      
      const { error: updateError } = await supabase
        .from('users')
        .update({ 
          token: newTokenCount.toString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', userId);

      if (updateError) {
        throw updateError;
      }

      return true;
    } catch (error) {
      console.error('Error updating tokens in Supabase:', error);
      return false;
    }
  };
  
  const handleClaim = async () => {
    setIsClaiming(true);
    
    try {
      // Update tokens in Supabase
      const success = await updateTokensInSupabase(totalReward);
      
      if (success) {
        setIsClaimed(true);
        setClaimedAmount(totalReward);
        
        // Trigger confetti effect
        setTimeout(() => {
          triggerConfetti();
        }, 500);
        
        // Show success modal
        setTimeout(() => {
          setShowSuccessModal(true);
        }, 800);
        
        // Call parent callback if provided
        if (onClaimTokens) {
          onClaimTokens(totalReward);
        }
      } else {
        throw new Error('Failed to update tokens in database');
      }
    } catch (error) {
      console.error('Error claiming tokens:', error);
      // You might want to show an error state here
    } finally {
      setIsClaiming(false);
    }
  };

  const closeSuccessModal = () => {
    setShowSuccessModal(false);
  };

  return (
    <>
      <motion.div
        className="relative overflow-hidden h-20 mb-8"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, delay: 0.1 }}
      >
        {/* Background gradient with animated sparkles */}
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600/20 via-pink-500/20 to-blue-600/20 rounded-xl blur-sm"></div>
        <div className="absolute inset-0 bg-gradient-to-r from-purple-500/10 via-pink-400/10 to-blue-500/10 rounded-xl"></div>
        
        {/* Animated sparkles background */}
        <div className="absolute inset-0 overflow-hidden rounded-xl">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute w-1 h-1 bg-gradient-to-r from-yellow-300 to-pink-300 rounded-full"
              style={{
                left: `${Math.random() * 100}%`,
                top: `${Math.random() * 100}%`,
              }}
              animate={{
                scale: [0, 1, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180, 360],
              }}
              transition={{
                duration: 2 + Math.random() * 1,
                repeat: Infinity,
                delay: Math.random() * 2,
              }}
            />
          ))}
        </div>

        <div className="relative glass-card border-2 border-gradient-to-r from-purple-500/30 via-pink-500/30 to-blue-500/30 rounded-xl h-full backdrop-blur-xl">
          {/* Single row layout */}
          <div className="flex items-center justify-between h-full px-6">
            {/* Left side - Icon and message */}
            <div className="flex items-center space-x-3">
              <motion.div 
                className="relative"
                animate={{ rotate: 360 }}
                transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
              >
                <div className="w-8 h-8 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                  <Gift className="w-4 h-4 text-white" />
                </div>
                <div className="absolute -inset-1 bg-gradient-to-r from-yellow-400 via-pink-500 to-purple-600 rounded-full blur opacity-30 animate-pulse"></div>
              </motion.div>
              
              <div className="flex items-center space-x-2">
                <h3 className="text-lg font-bold bg-gradient-to-r from-yellow-300 via-pink-300 to-purple-300 bg-clip-text text-transparent">
                  🎉 Verification Reward!
                </h3>
                {product.brandVerified && (
                  <div className="flex items-center space-x-1">
                    <Trophy className="w-3 h-3 text-yellow-400" />
                    <span className="text-yellow-300 text-xs font-medium">+Bonus</span>
                  </div>
                )}
              </div>
            </div>

            {/* Center - Token display */}
            <motion.div 
              className="flex items-center space-x-2 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-lg px-3 py-1 border border-yellow-500/30"
              whileHover={{ scale: 1.05 }}
            >
              <Coins className="w-4 h-4 text-yellow-400" />
              <span className="text-white font-bold text-lg">{totalReward}</span>
              <span className="text-yellow-300 text-sm font-medium">tokens</span>
            </motion.div>

            {/* Right side - Action */}
            <div className="flex items-center space-x-3">
              <div className="flex items-center space-x-1 text-xs text-white/60">
                <Clock className="w-3 h-3" />
                <span>Limited time</span>
              </div>

              {!isClaimed ? (
                <motion.button
                  onClick={handleClaim}
                  disabled={isClaiming}
                  className={`
                    relative overflow-hidden px-6 py-2 rounded-lg font-bold text-white text-sm
                    transition-all duration-300 shadow-lg
                    ${isClaiming 
                      ? 'cursor-not-allowed opacity-70' 
                      : 'hover:shadow-xl hover:scale-105 active:scale-95'
                    }
                  `}
                  style={{
                    background: isClaiming 
                      ? 'linear-gradient(45deg, #6b7280, #9ca3af)' 
                      : 'linear-gradient(45deg, #f59e0b, #ec4899, #8b5cf6, #3b82f6)',
                    backgroundSize: '300% 300%',
                    animation: isClaiming ? 'none' : 'gradient-shift 3s ease infinite',
                  }}
                  whileHover={{ 
                    boxShadow: "0 10px 20px rgba(236, 72, 153, 0.3)",
                  }}
                >
                  {/* Button background animation */}
                  <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-12 -translate-x-full animate-shimmer"></div>
                  
                  {isClaiming ? (
                    <div className="flex items-center space-x-2">
                      <div className="w-3 h-3 border border-white/30 border-t-white rounded-full animate-spin"></div>
                      <span>Claiming...</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2">
                      <Download className="w-3 h-3" />
                      <span>Claim {totalReward}</span>
                      <Sparkles className="w-3 h-3" />
                    </div>
                  )}
                </motion.button>
              ) : (
                <motion.div
                  className="flex items-center space-x-2 bg-gradient-to-r from-green-500/20 to-emerald-500/20 rounded-lg py-2 px-4 border border-green-500/30"
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5 }}
                >
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, ease: "easeInOut" }}
                  >
                    <CheckCircle className="w-4 h-4 text-green-400" />
                  </motion.div>
                  <span className="text-green-300 font-bold text-sm">Claimed!</span>
                  <Star className="w-4 h-4 text-yellow-400" />
                </motion.div>
              )}
            </div>
          </div>

          {/* Success confetti effect */}
          {isClaimed && (
            <div className="absolute inset-0 pointer-events-none">
              {[...Array(15)].map((_, i) => (
                <motion.div
                  key={i}
                  className="absolute w-1 h-1 rounded-full"
                  style={{
                    background: `hsl(${Math.random() * 360}, 70%, 60%)`,
                    left: '50%',
                    top: '50%',
                  }}
                  initial={{ scale: 0, x: 0, y: 0 }}
                  animate={{
                    scale: [0, 1, 0],
                    x: (Math.random() - 0.5) * 200,
                    y: (Math.random() - 0.5) * 200,
                  }}
                  transition={{
                    duration: 1.5,
                    ease: "easeOut",
                  }}
                />
              ))}
            </div>
          )}
        </div>

        <style jsx>{`
          @keyframes gradient-shift {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }
          
          @keyframes shimmer {
            0% { transform: translateX(-100%) skewX(-12deg); }
            100% { transform: translateX(200%) skewX(-12deg); }
          }
          
          .animate-shimmer {
            animation: shimmer 2s infinite;
          }
        `}</style>
      </motion.div>

      {/* Success Modal */}
      <AnimatePresence>
        {showSuccessModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4"
            onClick={closeSuccessModal}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.8, opacity: 0, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-gradient-to-br from-slate-800 to-slate-900 rounded-3xl border border-gradient-to-r from-purple-500/50 to-pink-500/50 w-full max-w-md overflow-hidden shadow-2xl"
            >
              {/* Modal Header */}
              <div className="relative p-8 text-center">
                <button
                  onClick={closeSuccessModal}
                  className="absolute top-4 right-4 text-white/60 hover:text-white transition-colors"
                >
                  <X size={20} />
                </button>

                {/* Success Icon */}
                <motion.div
                  className="w-20 h-20 bg-gradient-to-r from-green-400 to-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg"
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ delay: 0.2, type: "spring", stiffness: 200 }}
                >
                  <CheckCircle className="w-10 h-10 text-white" />
                </motion.div>

                {/* Success Message */}
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                >
                  <h3 className="text-2xl font-bold bg-gradient-to-r from-green-300 to-emerald-300 bg-clip-text text-transparent mb-2">
                    🎉 Tokens Claimed Successfully!
                  </h3>
                  
                  <p className="text-white/80 text-lg mb-6">
                    You've earned <span className="font-bold text-yellow-300">{claimedAmount}</span> tokens!
                  </p>

                  {/* Token breakdown */}
                  <div className="bg-white/5 rounded-xl p-4 mb-6 space-y-2">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-white/70">Base reward:</span>
                      <span className="text-white font-semibold">+{baseReward} tokens</span>
                    </div>
                    {product.brandVerified && (
                      <div className="flex justify-between items-center text-sm">
                        <span className="text-white/70">Verified brand bonus:</span>
                        <span className="text-yellow-300 font-semibold">+{bonusReward} tokens</span>
                      </div>
                    )}
                    <div className="border-t border-white/10 pt-2 flex justify-between items-center">
                      <span className="text-white font-bold">Total earned:</span>
                      <span className="text-green-300 font-bold">+{claimedAmount} tokens</span>
                    </div>
                  </div>

                  <button
                    onClick={closeSuccessModal}
                    className="w-full py-3 bg-gradient-to-r from-green-500 to-emerald-600 text-white rounded-xl font-semibold hover:from-green-600 hover:to-emerald-700 transition-all duration-300 shadow-lg hover:shadow-xl"
                  >
                    Awesome! 🚀
                  </button>
                </motion.div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default TokenClaimingSection;