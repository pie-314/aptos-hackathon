"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Package, MapPin, Hash, Calendar, CheckCircle, AlertCircle, Wallet, Users } from 'lucide-react';
import Link from 'next/link';

interface FormData {
  productName: string;
  origin: string;
  batchCode: string;
  expiryDate: string;
  batchCapacity: number;
}

interface WalletInfo {
  address: string;
  isConnected: boolean;
}

const RegisterProduct = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<FormData>({
    productName: '',
    origin: '',
    batchCode: '',
    expiryDate: '',
    batchCapacity: 1
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormData, string>>>({});
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);
  const [currentMintDate, setCurrentMintDate] = useState<string>('');
  const [submitError, setSubmitError] = useState<string>('');

  // Updated smart contract configuration to match the Move file
  const CONTRACT_ADDRESS =  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const REGISTRY_ADMIN_ADDRESS = `0x${CONTRACT_ADDRESS}`;  // Use 0x prefix for admin address
  const DEVNET_URL = "https://fullnode.devnet.aptoslabs.com";

  // Check wallet connection and generate mint date on component mount
  useEffect(() => {
    const checkWalletConnection = () => {
      const address = localStorage.getItem('walletAddress');
      const isConnected = localStorage.getItem('isWalletConnected') === 'true';
      
      if (!address || !isConnected) {
        router.push('/');
        return;
      }

      setWalletInfo({
        address,
        isConnected
      });
    };

    // Generate secure current mint date (UTC timezone)
    const generateMintDate = () => {
      const now = new Date();
      const utcDate = new Date(now.getTime() + (now.getTimezoneOffset() * 60000));
      const mintDate = utcDate.toISOString().split('T')[0]; // YYYY-MM-DD format
      setCurrentMintDate(mintDate);
    };

    checkWalletConnection();
    generateMintDate();
  }, [router]);

  const handleInputChange = (field: keyof FormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    if (submitError) {
      setSubmitError('');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<Record<keyof FormData, string>> = {};

    if (!formData.productName.trim()) {
      newErrors.productName = 'Product name is required';
    } else if (formData.productName.trim().length < 2) {
      newErrors.productName = 'Product name must be at least 2 characters';
    }

    if (!formData.origin.trim()) {
      newErrors.origin = 'Origin is required';
    } else if (formData.origin.trim().length < 2) {
      newErrors.origin = 'Origin must be at least 2 characters';
    }

    if (!formData.batchCode.trim()) {
      newErrors.batchCode = 'Batch code is required';
    } else if (formData.batchCode.trim().length < 3) {
      newErrors.batchCode = 'Batch code must be at least 3 characters';
    }

    if (!formData.expiryDate) {
      newErrors.expiryDate = 'Expiry date is required';
    } else if (new Date(formData.expiryDate) <= new Date(currentMintDate)) {
      newErrors.expiryDate = 'Expiry date must be after mint date';
    }

    if (!formData.batchCapacity || formData.batchCapacity < 1) {
      newErrors.batchCapacity = 'Batch capacity must be at least 1';
    } else if (formData.batchCapacity > 999999) {
      newErrors.batchCapacity = 'Batch capacity cannot exceed 999,999';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // Helper function to convert string to hex-encoded byte array for Aptos
  const stringToHexBytes = (str: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const hexString = '0x' + Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
    
    console.log(`Converting "${str}" to hex bytes:`, {
      original: str,
      bytes: Array.from(bytes),
      hex: hexString
    });
    
    return hexString;
  };

  // Helper function to convert date to timestamp (seconds since epoch)
  const dateToTimestamp = (dateString: string): string => {
    const timestamp = Math.floor(new Date(dateString + 'T00:00:00.000Z').getTime() / 1000);
    return timestamp.toString();
  };

  const mintBatchNFTs = async (): Promise<string[]> => {
    if (!window.aptos || !walletInfo?.address) {
      throw new Error('Wallet not connected');
    }

    try {
      // Convert form data to blockchain format using hex encoding
      const productNameHex = stringToHexBytes(formData.productName.trim());
      const originHex = stringToHexBytes(formData.origin.trim());
      const batchCodeHex = stringToHexBytes(formData.batchCode.trim());
      const mintTimestamp = dateToTimestamp(currentMintDate);
      const expiryTimestamp = dateToTimestamp(formData.expiryDate);

      console.log('Preparing batch NFT mint with data:', {
        productName: formData.productName,
        origin: formData.origin,
        batchCode: formData.batchCode,
        mintDate: currentMintDate,
        expiryDate: formData.expiryDate,
        batchCapacity: formData.batchCapacity,
        mintTimestamp,
        expiryTimestamp,
        encodedData: {
          productNameHex,
          originHex,
          batchCodeHex
        }
      });

      // Use the new batch minting function with correct address format
      const transaction = {
        type: "entry_function_payload",
        function: `0x${CONTRACT_ADDRESS}::TraceNFT::mint_batch_nfts_entry`,
        type_arguments: [],
        arguments: [
          REGISTRY_ADMIN_ADDRESS,  // registry_admin with 0x prefix
          productNameHex,          // product_name
          originHex,              // origin
          batchCodeHex,           // batch_code
          mintTimestamp,          // mint_date
          expiryTimestamp,        // expiry_date
          formData.batchCapacity.toString()  // batch_capacity
        ]
      };

      console.log('Transaction payload:', transaction);
      console.log('Submitting batch mint transaction...');
      
      const result = await window.aptos.signAndSubmitTransaction(transaction);
      console.log('Batch mint transaction result:', result);

      if (!result || typeof result !== 'object' || !('hash' in result) || typeof result.hash !== 'string') {
        throw new Error('Batch mint transaction failed - no transaction hash returned');
      }

      return [result.hash]; // Return array for consistency
    } catch (error: unknown) {
      console.error('Failed to mint batch NFTs:', error);
      throw error;
    }
  };

  const getBatchNFTIds = async (): Promise<string[]> => {
    if (!walletInfo?.address) return [];

    try {
      // Wait a bit more for the transaction to be processed
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Use get_batch_products to get NFT IDs for this specific batch
      const batchCodeHex = stringToHexBytes(formData.batchCode.trim());
      
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::TraceNFT::get_batch_products`,
          type_arguments: [],
          arguments: [walletInfo.address, batchCodeHex]
        })
      });

      if (!response.ok) {
        console.warn('Could not get batch NFT IDs');
        return [];
      }

      const data = await response.json();
      if (data && data[0] && Array.isArray(data[0])) {
        console.log('Batch NFT IDs:', data[0]);
        return data[0];
      }

      return [];
    } catch (error) {
      console.error('Error getting batch NFT IDs:', error);
      return [];
    }
  };

  const checkBrandRegistration = async (): Promise<{ isRegistered: boolean; brandName?: string }> => {
    if (!walletInfo?.address) {
      throw new Error('Wallet not connected');
    }

    try {
      // Check if registered
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::BrandRegistry::is_registered`,
          type_arguments: [],
          arguments: [REGISTRY_ADMIN_ADDRESS, walletInfo.address]
        })
      });

      if (!response.ok) {
        console.log('Brand registry check failed, assuming not registered');
        return { isRegistered: false };
      }

      const data: unknown = await response.json();
      const isRegistered = Array.isArray(data) && data[0] === true;
      
      if (isRegistered) {
        // Get brand name
        const nameResponse = await fetch(`${DEVNET_URL}/v1/view`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            function: `0x${CONTRACT_ADDRESS}::BrandRegistry::get_brand_name`,
            type_arguments: [],
            arguments: [REGISTRY_ADMIN_ADDRESS, walletInfo.address]
          })
        });

        let brandName = 'Unknown';
        if (nameResponse.ok) {
          const nameData = await nameResponse.json();
          if (nameData && nameData[0] && nameData[0].vec && nameData[0].vec[0]) {
            const brandNameBytes = nameData[0].vec[0];
            brandName = bytesToString(brandNameBytes);
          }
        }

        console.log('Brand registration status:', { isRegistered, brandName });
        return { isRegistered, brandName };
      }
      
      return { isRegistered: false };
    } catch (error) {
      console.error('Error checking brand registration:', error);
      return { isRegistered: false };
    }
  };

  const ensureNFTMapExists = async () => {
    if (!walletInfo?.address || !window.aptos) {
      throw new Error('Wallet not connected');
    }

    try {
      // Check if NFTMap already exists using the correct format for Aptos REST API
      // The resource type should be in the format: 0xADDRESS::MODULE::STRUCT
      const resourceType = `0x${CONTRACT_ADDRESS}::TraceNFT::NFTMap`;
      const resourceUrl = `${DEVNET_URL}/v1/accounts/${walletInfo.address}/resource/${resourceType}`;
      
      console.log('Checking NFTMap at:', resourceUrl);
      const response = await fetch(resourceUrl);
      
      if (response.ok) {
        console.log('NFTMap already exists');
        return true;
      }

      if (response.status === 404) {
        console.log('NFTMap does not exist, creating...');

        // Create NFTMap using the init_nftmap function
        const initTransaction = {
          type: "entry_function_payload",
          function: `${CONTRACT_ADDRESS}::TraceNFT::init_nftmap`,
          type_arguments: [],
          arguments: []
        };

        console.log('Submitting NFTMap init transaction...');
        const initResult = await window.aptos.signAndSubmitTransaction(initTransaction);
        console.log('NFTMap initialization result:', initResult);

        if (!initResult?.hash) {
          throw new Error('NFTMap initialization failed - no transaction hash');
        }

        // Wait for transaction to be processed
        console.log('Waiting for NFTMap initialization to complete...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        return true;
      } else {
        const errorText = await response.text();
        console.error('Resource check failed:', response.status, errorText);
        
        // If it's a parsing error but the resource might exist, try to proceed
        if (response.status === 400 && errorText.includes('parse')) {
          console.log('Resource parsing failed, assuming NFTMap exists and proceeding...');
          return true;
        }
        
        throw new Error(`Failed to check NFTMap resource: ${response.status} - ${errorText}`);
      }

    } catch (error: unknown) {
      console.error('Error ensuring NFTMap exists:', error);
      
      // If it already exists, that's fine
      if (error instanceof Error && (
          error.message?.includes('NFTMAP_ALREADY_EXISTS') || 
          error.message?.includes('already exists') ||
          error.message?.includes('RESOURCE_ALREADY_EXISTS'))) {
        console.log('NFTMap already exists (from error message)');
        return true;
      }
      
      // If it's a parsing error, try to proceed anyway
      if (error instanceof Error && error.message?.includes('parse')) {
        console.log('Resource parsing error, trying to proceed with NFTMap creation...');
        
        // Try to create NFTMap directly
        try {
          const initTransaction = {
            type: "entry_function_payload",
            function: `${CONTRACT_ADDRESS}::TraceNFT::init_nftmap`,
            type_arguments: [],
            arguments: []
          };

          console.log('Attempting to create NFTMap...');
          const initResult = await window.aptos.signAndSubmitTransaction(initTransaction);
          
          if (initResult?.hash) {
            console.log('NFTMap created successfully');
            await new Promise(resolve => setTimeout(resolve, 3000));
            return true;
          }
        } catch (createError) {
          console.log('NFTMap creation failed, but may already exist:', createError);
          // Continue anyway - the map might already exist
          return true;
        }
      }
      
      throw error;
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    if (!walletInfo) {
      setSubmitError('Wallet not connected. Please connect your wallet first.');
      return;
    }

    if (!window.aptos) {
      setSubmitError('Petra wallet not found. Please install Petra wallet extension.');
      return;
    }

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Verify wallet is still connected
      const isConnected = await window.aptos.isConnected();
      if (!isConnected) {
        throw new Error('Wallet disconnected. Please reconnect your Petra wallet.');
      }

      // Check network
      try {
        const currentNetwork = await window.aptos.network();
        if (currentNetwork !== "Devnet") {
          throw new Error('Please switch your Petra wallet to Devnet network.');
        }
      } catch (networkError) {
        console.warn('Could not verify network:', networkError);
        // Continue anyway as some versions may not support network check
      }

      // Step 1: Check brand registration and get brand name
      console.log('Step 1: Checking brand registration...');
      setSubmitError('Verifying brand registration...');
      const brandInfo = await checkBrandRegistration();
      
      if (!brandInfo.isRegistered) {
        throw new Error('Your wallet is not registered as a brand. Please contact support to register your brand first.');
      }

      console.log('🏷️ Brand registered as:', brandInfo.brandName);

      // Step 2: Ensure NFTMap exists
      console.log('Step 2: Checking/Creating NFTMap...');
      setSubmitError('Preparing wallet for product registration...');
      await ensureNFTMapExists();

      // Step 3: Mint the batch NFTs
      console.log('Step 3: Minting batch NFTs...');
      setSubmitError(`Registering ${formData.batchCapacity} product${formData.batchCapacity > 1 ? 's' : ''} on blockchain...`);
      const transactionHashes = await mintBatchNFTs();

      // Step 4: Wait and get the batch NFT IDs
      console.log('Step 4: Getting batch NFT IDs...');
      setSubmitError('Finalizing registration...');
      
      // Wait for transaction to complete
      await new Promise(resolve => setTimeout(resolve, 5000));
      
      // Try to get the batch NFT IDs
      const batchNftIds = await getBatchNFTIds();

      console.log('✅ Batch registered successfully!');
      console.log('📋 Transaction Hash:', transactionHashes[0]);
      console.log('📦 Batch capacity:', formData.batchCapacity);
      console.log('🆔 NFT IDs created:', batchNftIds.length);
      console.log('🏷️ Actual brand name from blockchain:', brandInfo.brandName);
      
      if (batchNftIds.length > 0) {
        console.log('🆔 First NFT ID:', batchNftIds[0]);
        
        // The QR codes will use the actual brand name from blockchain
        const cleanBrandName = brandInfo.brandName?.replace(/[^a-zA-Z0-9]/g, '').toLowerCase() || 'unknown';
        const sampleQrUrl = `${window.location.origin}/verify/${cleanBrandName}/${batchNftIds[0]}`;
        
        console.log('📱 QR code URL format:', sampleQrUrl);
        console.log(`✅ QR codes will use actual brand name "${brandInfo.brandName}" (cleaned: "${cleanBrandName}")`);
        console.log(`📱 All QR codes will follow format: ${window.location.origin}/verify/${cleanBrandName}/[product-id]`);
        
        // Redirect to batch view
        router.push(`/product/${encodeURIComponent(formData.batchCode)}`);
      } else {
        // Fallback: redirect to dashboard
        console.warn('Could not get batch NFT IDs, redirecting to dashboard');
        router.push('/dashboard');
      }

    } catch (error: unknown) {
      console.error('Registration failed:', error);
      
      let errorMessage = 'Failed to register product batch. Please try again.';
      
      if (error instanceof Error) {
        const msg = error.message.toLowerCase();
        
        if (msg.includes('user rejected') || msg.includes('user denied') || msg.includes('rejected')) {
          errorMessage = 'Transaction was rejected. Please approve the transaction in your Petra wallet.';
        } else if (msg.includes('network') || msg.includes('devnet')) {
          errorMessage = 'Please ensure your Petra wallet is connected to Aptos Devnet.';
        } else if (msg.includes('insufficient') || msg.includes('funds')) {
          errorMessage = 'Insufficient APT balance for gas fees. Please add some APT to your wallet.';
        } else if (msg.includes('not_registered_brand') || msg.includes('e_not_registered')) {
          errorMessage = 'Your wallet is not registered as a brand. Please contact support to register your brand first.';
        } else if (msg.includes('batch_capacity_exceeded')) {
          errorMessage = 'Batch capacity exceeded. This batch code already has products registered.';
        } else if (msg.includes('invalid_batch_capacity')) {
          errorMessage = 'Invalid batch capacity. Please enter a number between 1 and 999,999.';
        } else if (msg.includes('invalid_expiry_date')) {
          errorMessage = 'Invalid expiry date. Expiry date must be after mint date.';
        } else if (msg.includes('timeout') || msg.includes('expired')) {
          errorMessage = 'Transaction timed out. Please ensure you approve transactions quickly in Petra wallet.';
        } else if (msg.includes('simulation') || msg.includes('execution')) {
          errorMessage = 'Transaction simulation failed. Please check your inputs and try again.';
        } else if (msg.includes('brand registration')) {
          errorMessage = error.message;
        } else if (msg.includes('cannot read properties') || msg.includes('map')) {
          errorMessage = 'Transaction format error. Please try again or check your wallet connection.';
        } else if (error.message) {
          errorMessage = error.message;
        }
      }
      
      setSubmitError(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!walletInfo) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p>Checking wallet connection...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center space-x-4">
            <Link 
              href="/dashboard"
              className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Dashboard</span>
            </Link>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold gradient-text">Register Product Batch</h1>
            <p className="text-white/70 mt-1">Create blockchain certificates for your product batch</p>
            <div className="flex items-center space-x-2 mt-2">
              <Wallet size={16} className="text-green-400" />
              <span className="text-green-400 text-sm font-mono">
                {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <motion.div
          className="glass-card p-8 rounded-2xl"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          {/* Error Display */}
          {submitError && (
            <motion.div
              className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
            >
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400" />
                <div>
                  <p className="text-red-400 font-medium">
                    {isSubmitting ? 'Processing...' : 'Registration Failed'}
                  </p>
                  <p className="text-white/70 text-sm">{submitError}</p>
                </div>
              </div>
            </motion.div>
          )}

          {/* Brand Registration Warning */}
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-8">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-yellow-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-yellow-400 font-semibold mb-1">Brand Registration Required</h3>
                <ul className="text-white/70 text-sm space-y-1">
                  <li>• Your wallet must be registered as a brand to mint NFTs</li>
                  <li>• This will create multiple NFTs in a single batch</li>
                  <li>• If you get a &quot;not registered brand&quot; error, contact support</li>
                  <li>• Ensure you have sufficient APT for gas fees</li>
                </ul>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Product Name */}
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <Package size={18} />
                <span>Product Name</span>
              </label>
              <input
                type="text"
                value={formData.productName}
                onChange={(e) => handleInputChange('productName', e.target.value)}
                placeholder="Enter product name"
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                  errors.productName 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
                disabled={isSubmitting}
              />
              {errors.productName && (
                <p className="text-red-400 text-sm mt-1">{errors.productName}</p>
              )}
            </div>

            {/* Origin */}
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <MapPin size={18} />
                <span>Origin</span>
              </label>
              <input
                type="text"
                value={formData.origin}
                onChange={(e) => handleInputChange('origin', e.target.value)}
                placeholder="Enter country or region of origin"
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                  errors.origin 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
                disabled={isSubmitting}
              />
              {errors.origin && (
                <p className="text-red-400 text-sm mt-1">{errors.origin}</p>
              )}
            </div>

            {/* Batch Code and Capacity */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="flex items-center space-x-2 text-white font-medium mb-3">
                  <Hash size={18} />
                  <span>Batch Code</span>
                </label>
                <input
                  type="text"
                  value={formData.batchCode}
                  onChange={(e) => handleInputChange('batchCode', e.target.value)}
                  placeholder="Enter unique batch code"
                  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                    errors.batchCode 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-white/10 focus:ring-purple-500'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.batchCode && (
                  <p className="text-red-400 text-sm mt-1">{errors.batchCode}</p>
                )}
              </div>

              <div>
                <label className="flex items-center space-x-2 text-white font-medium mb-3">
                  <Users size={18} />
                  <span>Batch Capacity</span>
                </label>
                <input
                  type="number"
                  min="1"
                  max="999999"
                  value={formData.batchCapacity}
                  onChange={(e) => handleInputChange('batchCapacity', (parseInt(e.target.value) || 1).toString())}
                  placeholder="Number of NFTs to create"
                  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                    errors.batchCapacity 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-white/10 focus:ring-purple-500'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.batchCapacity && (
                  <p className="text-red-400 text-sm mt-1">{errors.batchCapacity}</p>
                )}
                <p className="text-white/60 text-sm mt-1">
                  Number of individual NFT certificates to create in this batch (1-999,999)
                </p>
              </div>
            </div>

            {/* Date Fields */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Auto-Generated Mint Date (Read-only) */}
              <div>
                <label className="flex items-center space-x-2 text-white font-medium mb-3">
                  <Calendar size={18} />
                  <span>Mint Date (Auto-Generated)</span>
                </label>
                <input
                  type="date"
                  value={currentMintDate}
                  readOnly
                  className="w-full px-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white cursor-not-allowed opacity-70"
                />
                <p className="text-white/60 text-sm mt-1">
                  Automatically set to current date (UTC timezone)
                </p>
              </div>

              {/* Expiry Date */}
              <div>
                <label className="flex items-center space-x-2 text-white font-medium mb-3">
                  <Calendar size={18} />
                  <span>Expiry Date</span>
                </label>
                <input
                  type="date"
                  value={formData.expiryDate}
                  onChange={(e) => handleInputChange('expiryDate', e.target.value)}
                  min={currentMintDate}
                  className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white focus:outline-none focus:ring-2 transition-all ${
                    errors.expiryDate 
                      ? 'border-red-500 focus:ring-red-500' 
                      : 'border-white/10 focus:ring-purple-500'
                  }`}
                  disabled={isSubmitting}
                />
                {errors.expiryDate && (
                  <p className="text-red-400 text-sm mt-1">{errors.expiryDate}</p>
                )}
              </div>
            </div>

            {/* Batch Info */}
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4">
              <h3 className="text-blue-400 font-semibold mb-2">Batch Summary</h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                <div>
                  <span className="text-white/60">NFTs to create:</span>
                  <span className="text-white ml-2 font-mono">{formData.batchCapacity}</span>
                </div>
                <div>
                  <span className="text-white/60">Batch code:</span>
                  <span className="text-white ml-2 font-mono">{formData.batchCode || 'Not set'}</span>
                </div>
                <div>
                  <span className="text-white/60">Mint date:</span>
                  <span className="text-white ml-2">{currentMintDate || 'Not set'}</span>
                </div>
                <div>
                  <span className="text-white/60">Expiry date:</span>
                  <span className="text-white ml-2">{formData.expiryDate || 'Not set'}</span>
                </div>
              </div>
            </div>

            {/* Transaction Info */}
            <div className="bg-white/5 p-4 rounded-xl">
              <h3 className="text-white font-semibold mb-2">Blockchain Registration</h3>
              <p className="text-white/70 text-sm mb-3">
                This will create {formData.batchCapacity} permanent, immutable record{formData.batchCapacity > 1 ? 's' : ''} on the Aptos blockchain. 
                You may need to approve 1-2 transactions in your Petra wallet.
              </p>
              <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-3 mb-3">
                <p className="text-blue-400 text-sm font-medium mb-1">QR Code URLs</p>
                <p className="text-white/70 text-xs">
                  Your QR codes will use friendly URLs with your brand name instead of wallet addresses:
                  <br />
                  <code className="text-blue-300">
                    {window.location.origin}/verify/[your-brand-name]/[product-id]
                  </code>
                </p>
              </div>
              <div className="flex items-center space-x-2 text-sm">
                <span className="text-white/60">Network:</span>
                <span className="text-green-400">Aptos Devnet</span>
                <span className="text-white/60">•</span>
                <span className="text-white/60">Estimated Gas:</span>
                <span className="text-blue-400">~{(0.02 + (formData.batchCapacity * 0.001)).toFixed(3)} APT</span>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6">
              <Link
                href="/dashboard"
                className="px-6 py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all duration-300"
              >
                Cancel
              </Link>
              <motion.button
                type="submit"
                disabled={isSubmitting}
                className="px-8 py-3 gradient-purple-blue text-white rounded-xl font-medium hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-300 flex items-center space-x-2"
                whileHover={{ scale: isSubmitting ? 1 : 1.02 }}
                whileTap={{ scale: isSubmitting ? 1 : 0.98 }}
              >
                {isSubmitting ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Creating {formData.batchCapacity} NFT{formData.batchCapacity > 1 ? 's' : ''}...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle size={20} />
                    <span>Register Batch ({formData.batchCapacity} NFT{formData.batchCapacity > 1 ? 's' : ''})</span>
                  </>
                )}
              </motion.button>
            </div>
          </form>
        </motion.div>
      </div>
    </div>
  );
};

function bytesToString(brandNameBytes: any): string {
  try {
    // Handle different possible formats from Aptos blockchain
    if (typeof brandNameBytes === 'string') {
      // If it's already a string, return as-is
      return brandNameBytes;
    }
    
    if (Array.isArray(brandNameBytes)) {
      // If it's an array of byte values, convert to string
      return String.fromCharCode(...brandNameBytes.map(byte => 
        typeof byte === 'number' ? byte : parseInt(byte, 10)
      ));
    }
    
    if (brandNameBytes && typeof brandNameBytes === 'object' && brandNameBytes.data) {
      // Handle wrapped byte data
      return bytesToString(brandNameBytes.data);
    }
    
    // Fallback for unknown format
    return String(brandNameBytes);
  } catch (error) {
    console.error('Error converting bytes to string:', error);
    return 'Unknown';
  }
}

export default RegisterProduct;
