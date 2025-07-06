"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import Link from 'next/link';
import { Shield, Smartphone, Zap } from 'lucide-react';
import ConnectWalletModal from './connect-wallet-modal';

// Static particle positions to avoid hydration mismatch
const particlePositions = [
  { left: '20%', top: '15%' },
  { left: '80%', top: '25%' },
  { left: '15%', top: '60%' },
  { left: '85%', top: '70%' },
  { left: '50%', top: '10%' },
  { left: '70%', top: '85%' },
];

const Hero: React.FC = () => {
  const [isWalletModalOpen, setIsWalletModalOpen] = useState<boolean>(false);

  const handleForBrandsClick = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsWalletModalOpen(true);
  };

  return (
    <>
      <section className="relative min-h-screen flex items-center justify-center blockchain-bg cyber-grid pt-20">
        {/* Animated particles */}
        <div className="absolute inset-0 overflow-hidden">
          {particlePositions.map((position, i) => (
            <motion.div
              key={i}
              className="absolute w-2 h-2 bg-gradient-to-r from-purple-500 to-blue-500 rounded-full opacity-30"
              style={{
                left: position.left,
                top: position.top,
              }}
              animate={{
                y: [-20, 20, -20],
                rotate: [0, 180, 360],
                opacity: [0.3, 0.6, 0.3],
              }}
              transition={{
                duration: 3 + i * 0.5,
                repeat: Infinity,
                ease: "easeInOut",
                delay: i * 0.3,
              }}
            />
          ))}
        </div>

        <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
          >
            {/* Badge */}
            <motion.div
              className="inline-flex items-center px-4 py-2 mt-5 rounded-full glass-card mb-8 text-sm font-medium text-white/90"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.6, delay: 0.2 }}
            >
              <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse"></span>
              Powered by Aptos Blockchain
            </motion.div>

            {/* Main Heading */}
            <motion.h1
              className="text-5xl md:text-7xl font-bold mb-6 leading-tight"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3 }}
            >
              <span className="gradient-text">Authentic</span>
              <br />
              <span className="text-white">Product</span>
              <br />
              <span className="gradient-text">Verification</span>
            </motion.h1>

            {/* Subheading */}
            <motion.p
              className="text-xl md:text-2xl text-white/80 mb-8 max-w-3xl mx-auto leading-relaxed"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.5 }}
            >
              Help brands issue unique, scannable certificates (NFTs) to prove their product batches are genuine. 
              <span className="text-cyber-green font-semibold"> Trust through technology.</span>
            </motion.p>

            {/* CTA Buttons */}
            <motion.div
              className="flex flex-col sm:flex-row gap-4 justify-center items-center mb-16"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.7 }}
            >
              <motion.button
                onClick={handleForBrandsClick}
                className="px-8 py-4 gradient-purple-blue text-white font-semibold rounded-xl hover:shadow-2xl transition-all duration-300 glow-purple min-w-[200px]"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                For Brands
              </motion.button>
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Link
                  href="/scan"
                  className="px-8 py-4 glass-card text-white font-semibold rounded-xl hover:glow-green transition-all duration-300 min-w-[200px] block"
                >
                  For Consumers (Scan QR)
                </Link>
              </motion.div>
            </motion.div>

            {/* Trust Indicators */}
            <motion.div
              className="grid grid-cols-1 md:grid-cols-3 mb-5 gap-6 max-w-4xl mx-auto"
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.9 }}
            >
              {[{
                icon: Shield,
                title: "Blockchain Secured",
                description: "Immutable certificates stored on Aptos blockchain",
                gradient: "from-purple-500 to-blue-500",
                hoverEffect: "hover:glow-purple"
              },
              {
                icon: Smartphone,
                title: "Easy Scanning",
                description: "QR codes for instant product verification",
                gradient: "from-green-500 to-emerald-500",
                hoverEffect: "hover:glow-green"
              },
              {
                icon: Zap,
                title: "Lightning Fast",
                description: "Built on Aptos for speed and efficiency",
                gradient: "from-blue-500 to-cyan-500",
                hoverEffect: "hover:glow-purple"
              }
              ].map((item, index) => {
                const IconComponent = item.icon;
                return (
                  <motion.div
                    key={index}
                    className={`glass-subtle p-6 rounded-2xl ${item.hoverEffect} transition-all duration-300`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.6, delay: 1.1 + index * 0.1 }}
                    whileHover={{ scale: 1.02, y: -5 }}
                  >
                    <div className={`w-12 h-12 bg-gradient-to-r ${item.gradient} rounded-xl flex items-center justify-center mb-4 mx-auto`}>
                      <IconComponent className="w-6 h-6 text-white" />
                    </div>
                    <h3 className="text-lg font-semibold text-white mb-2">{item.title}</h3>
                    <p className="text-white/70">{item.description}</p>
                  </motion.div>
                );
              })}
            </motion.div>
        </motion.div>
      </div>

      {/* Bottom gradient fade */}
      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-slate-900 to-transparent"></div>
    </section>

    {/* Connect Wallet Modal */}
    <ConnectWalletModal 
      isOpen={isWalletModalOpen} 
      onClose={() => setIsWalletModalOpen(false)} 
    />
    </>
  );
};

export default Hero;
