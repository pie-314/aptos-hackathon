"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Plus, Search, Filter, Package, Calendar, MapPin, Hash, Wallet, AlertCircle, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

interface ProductNFT {
  id: string;
  productName: string;
  origin: string;
  batchCode: string;
  mintDate: string;
  expiryDate: string;
  status: string;
  used: boolean;
  firstScannedAt?: string;
}

interface BatchGroup {
  batchCode: string;
  productName: string;
  origin: string;
  mintDate: string;
  expiryDate: string;
  status: string;
  count: number;
  nftIds: string[];
  firstId: string; // For navigation purposes
}

interface WalletInfo {
  address: string;
  isConnected: boolean;
}

const Dashboard = () => {
  const router = useRouter();
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [products, setProducts] = useState<ProductNFT[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  // Smart contract configuration - Updated to match Move file
  const CONTRACT_ADDRESS =  process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const DEVNET_URL = "https://fullnode.devnet.aptoslabs.com";

  // Check wallet connection on component mount
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

    checkWalletConnection();
  }, [router]);

  // Fetch products from blockchain
  useEffect(() => {
    if (walletInfo?.address) {
      fetchProducts();
    }
  }, [walletInfo]);

  // Enhanced brand name fetching function
  const fetchBrandName = async (brandAddress: string): Promise<string> => {
    try {
      console.log(`Dashboard: Fetching brand name for address: ${brandAddress}`);
      
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::BrandRegistry::get_brand_name`,
          type_arguments: [],
          arguments: [`0x${CONTRACT_ADDRESS}`, brandAddress]
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Dashboard: Brand name response:", data);
        
        if (data && data[0] && data[0].vec && data[0].vec[0]) {
          const brandNameBytes = data[0].vec[0];
          let brandName = bytesToString(brandNameBytes);
          
          console.log("Dashboard: Raw brand name:", brandName);
          
          // Validate the brand name
          if (brandName && 
              brandName.trim().length > 0 && 
              brandName !== 'Unknown' && 
              brandName !== 'undefined') {
            
            // Clean brand name for URL usage
            const cleanBrandName = brandName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
            
            if (cleanBrandName.length > 0) {
              console.log("Dashboard: Using brand name:", cleanBrandName);
              return cleanBrandName;
            }
          }
        }
      } else {
        console.warn("Dashboard: Failed to fetch brand name, checking registration status");
        
        // Check if brand is registered
        const isRegistered = await checkBrandRegistrationStatus(brandAddress);
        if (!isRegistered) {
          console.warn("Dashboard: Brand is not registered");
        }
      }
    } catch (error) {
      console.warn('Dashboard: Failed to fetch brand name:', error);
    }
    
    // Fallback: use shortened address
    const fallback = `brand-${brandAddress.slice(2, 8)}`;
    console.log("Dashboard: Using fallback identifier:", fallback);
    return fallback;
  };

  // Helper function to check brand registration
  const checkBrandRegistrationStatus = async (brandAddress: string): Promise<boolean> => {
    try {
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::BrandRegistry::is_registered`,
          type_arguments: [],
          arguments: [`0x${CONTRACT_ADDRESS}`, brandAddress]
        })
      });

      if (response.ok) {
        const data = await response.json();
        return Array.isArray(data) && data[0] === true;
      }
    } catch (error) {
      console.warn('Failed to check brand registration status:', error);
    }
    
    return false;
  };

  const fetchProducts = async () => {
    if (!walletInfo?.address) return;

    setLoading(true);
    setError('');

    try {
      console.log("Fetching products for address:", walletInfo.address);

      // Get brand name first
      const brandName = await fetchBrandName(walletInfo.address);
      console.log("Brand name for verification URLs:", brandName);

      // First, get all NFT IDs using the new method
      const nftIdsResponse = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::TraceNFT::get_all_nft_ids`,
          type_arguments: [],
          arguments: [walletInfo.address]
        })
      });

      if (!nftIdsResponse.ok) {
        if (nftIdsResponse.status === 404) {
          console.log("NFTMap not found for this address - no products yet");
          setProducts([]);
          setLoading(false);
          return;
        }
        throw new Error(`Failed to fetch NFT IDs: ${nftIdsResponse.statusText}`);
      }

      const nftIdsData = await nftIdsResponse.json();
      console.log("NFT IDs response:", nftIdsData);

      // Check if we have any NFT IDs
      if (!nftIdsData || !nftIdsData[0] || !Array.isArray(nftIdsData[0]) || nftIdsData[0].length === 0) {
        console.log("No NFT IDs found");
        setProducts([]);
        setLoading(false);
        return;
      }

      const nftIds = nftIdsData[0];
      console.log("Found NFT IDs:", nftIds);

      // Fetch NFTs individually with brand name for verification URLs
      const productPromises = nftIds.map((id: string) => 
        fetchNFTDetails(walletInfo.address, id, brandName)
      );

      const productResults = await Promise.allSettled(productPromises);
      const validProducts: ProductNFT[] = [];

      productResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          validProducts.push({
            id: nftIds[index],
            ...result.value
          });
        }
      });

      console.log("Fetched products:", validProducts);
      setProducts(validProducts);

    } catch (err) {
      console.error("Error fetching products:", err);
      setError("Failed to load products. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const fetchNFTDetails = async (brandAddress: string, nftId: string, brandName: string): Promise<Omit<ProductNFT, 'id'> | null> => {
    try {
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::TraceNFT::get_nft`,
          type_arguments: [],
          arguments: [brandAddress, nftId]
        })
      });

      const data = await response.json();
      
      if (!response.ok || !data || !data[0] || data[0].vec === undefined) {
        console.log(`NFT ${nftId} not found or invalid response:`, data);
        return null;
      }

      const nftData = data[0].vec[0];
      return parseNFTInfo(nftData, brandName, nftId);

    } catch (err) {
      console.error(`Error fetching NFT ${nftId}:`, err);
      return null;
    }
  };

  const parseNFTInfo = (nftData: unknown, brandName: string, nftId: string): Omit<ProductNFT, 'id'> | null => {
    try {
      console.log(`Parsing NFT data:`, nftData);
      
      const data = nftData as Record<string, unknown>;
      
      // Convert byte arrays to strings with improved handling
      const productName = bytesToString(data.product_name);
      const origin = bytesToString(data.origin);
      const batchCode = bytesToString(data.batch_code);
      
      console.log(`Converted strings:`, {
        productName,
        origin,
        batchCode,
        rawProductName: data.product_name,
        rawOrigin: data.origin,
        rawBatchCode: data.batch_code
      });
      
      // Convert timestamps to dates with validation
      const mintTimestamp = safeParseBigInt(data.mint_date);
      const expiryTimestamp = safeParseBigInt(data.expiry_date);
      
      // Convert to date strings, handling potential invalid timestamps
      const mintDate = mintTimestamp ? safeTimestampToDate(mintTimestamp) : 'Invalid Date';
      const expiryDate = expiryTimestamp ? safeTimestampToDate(expiryTimestamp) : 'Invalid Date';
      
      // Determine status
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = expiryTimestamp && currentTime > expiryTimestamp;
      const isExpiringSoon = expiryTimestamp && !isExpired && (expiryTimestamp - currentTime) < (30 * 24 * 60 * 60); // 30 days
      
      let status = 'Active';
      if (isExpired) {
        status = 'Expired';
      } else if (isExpiringSoon) {
        status = 'Expiring Soon';
      }

      const firstScannedData = data.first_scanned_at as { vec?: unknown[] } | undefined;
      
      return {
        productName,
        origin,
        batchCode,
        mintDate,
        expiryDate,
        status,
        used: Boolean(data.used),
        firstScannedAt: firstScannedData?.vec?.[0] 
          ? safeTimestampToISO(safeParseBigInt(firstScannedData.vec[0]))
          : undefined
      };

    } catch (err) {
      console.error("Error parsing NFT info:", err, "Data:", nftData);
      return null;
    }
  };

  // Improved function to convert bytes to string
  const bytesToString = (byteData: unknown): string => {
    try {
      console.log("Converting bytes to string:", byteData);
      
      if (!byteData) {
        return 'Unknown';
      }

      const bytes: number[] = [];

      // Handle hex string format (new format from the updated contract)
      if (typeof byteData === 'string' && byteData.startsWith('0x')) {
        const hexString = byteData.slice(2); // Remove '0x' prefix
        console.log("Processing hex string:", hexString);
        
        // Ensure even length by padding with 0 if necessary
        const paddedHex = hexString.length % 2 === 0 ? hexString : '0' + hexString;
        
        // Convert hex pairs to bytes
        for (let i = 0; i < paddedHex.length; i += 2) {
          const hexPair = paddedHex.substr(i, 2);
          const byte = parseInt(hexPair, 16);
          if (!isNaN(byte) && byte > 0) { // Skip null bytes
            bytes.push(byte);
          }
        }
        
        // First decode attempt
        if (bytes.length > 0) {
          try {
            const firstDecode = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
            console.log("First decode result:", firstDecode);
            
            // Check if the result is another hex string (double-encoded)
            if (firstDecode.startsWith('0x')) {
              console.log("Detected double-encoded hex, decoding again...");
              const innerHex = firstDecode.slice(2);
              const innerBytes: number[] = [];
              
              // Ensure even length
              const paddedInnerHex = innerHex.length % 2 === 0 ? innerHex : '0' + innerHex;
              
              // Convert inner hex pairs to bytes
              for (let i = 0; i < paddedInnerHex.length; i += 2) {
                const hexPair = paddedInnerHex.substr(i, 2);
                const byte = parseInt(hexPair, 16);
                if (!isNaN(byte) && byte > 0) {
                  innerBytes.push(byte);
                }
              }
              
              if (innerBytes.length > 0) {
                const finalResult = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(innerBytes));
                const cleaned = finalResult.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                
                console.log("Double decode result:", {
                  firstDecode,
                  innerHex,
                  innerBytes: innerBytes.slice(0, 10),
                  finalResult,
                  cleaned
                });
                
                return cleaned.length > 0 ? cleaned : 'Unknown';
              }
            } else {
              // Single decode was sufficient
              const cleaned = firstDecode.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
              return cleaned.length > 0 ? cleaned : 'Unknown';
            }
          } catch {
            console.warn("Decode failed");
          }
        }
      }
      // Handle array format (legacy format)
      else if (Array.isArray(byteData)) {
        const processedBytes = byteData.map(item => {
          if (typeof item === 'number') return item;
          if (typeof item === 'string') {
            if (item.startsWith('0x')) {
              return parseInt(item, 16);
            } else {
              const num = parseInt(item, 10);
              return isNaN(num) ? parseInt(item, 16) : num;
            }
          }
          return 0;
        }).filter((byte: number) => byte !== 0); // Filter out null bytes
        
        bytes.push(...processedBytes);
      }
      // Handle plain string (already readable)
      else if (typeof byteData === 'string' && !byteData.startsWith('0x')) {
        return byteData;
      }
      // Handle object with data property
      else if (typeof byteData === 'object' && byteData !== null && 'data' in byteData) {
        const dataObj = byteData as { data: unknown[] };
        if (Array.isArray(dataObj.data)) {
          const processedBytes = dataObj.data.map((item: unknown) => {
            if (typeof item === 'number') return item;
            return parseInt(String(item), 10);
          }).filter((byte: number) => byte !== 0); // Filter out null bytes
          
          bytes.push(...processedBytes);
        }
      }

      // Fallback for non-hex string formats
      if (bytes.length === 0) {
        return 'Unknown';
      }

      // Convert bytes to string using proper UTF-8 decoding
      try {
        const result = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(bytes));
        // Clean up any remaining control characters and trim whitespace
        const cleaned = result.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
        
        console.log("Standard conversion result:", {
          input: byteData,
          bytes: bytes.slice(0, 20), // Log first 20 bytes
          result: result,
          cleaned: cleaned
        });
        
        // Return the cleaned result, or 'Unknown' if it's empty after cleaning
        return cleaned.length > 0 ? cleaned : 'Unknown';
        
      } catch {
        console.warn("UTF-8 decode failed, trying ASCII fallback");
        // Fallback: convert bytes to ASCII characters directly
        const asciiResult = bytes
          .filter(byte => byte >= 32 && byte <= 126) // Only printable ASCII
          .map(byte => String.fromCharCode(byte))
          .join('');
        
        return asciiResult.length > 0 ? asciiResult : 'Unknown';
      }
      
    } catch (err) {
      console.error("Error converting bytes to string:", err, "Input:", byteData);
      return 'Unknown';
    }
  };

  // Helper function to safely parse BigInt/string to number
  const safeParseBigInt = (value: unknown): number | null => {
    try {
      if (value === null || value === undefined) return null;
      
      if (typeof value === 'number') return value;
      if (typeof value === 'string') {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
      }
      
      // Handle BigInt or string representation of BigInt
      const stringValue = String(value);
      const parsed = parseInt(stringValue, 10);
      return isNaN(parsed) ? null : parsed;
    } catch (err) {
      console.error("Error parsing BigInt:", err, "Value:", value);
      return null;
    }
  };

  // Helper function to safely convert timestamp to date string
  const safeTimestampToDate = (timestamp: number): string => {
    try {
      // Handle both seconds and milliseconds
      const date = timestamp > 1e10 ? new Date(timestamp) : new Date(timestamp * 1000);
      
      if (isNaN(date.getTime())) {
        return 'Invalid Date';
      }
      
      return date.toISOString().split('T')[0];
    } catch (err) {
      console.error("Error converting timestamp to date:", err, "Timestamp:", timestamp);
      return 'Invalid Date';
    }
  };

  // Helper function to safely convert timestamp to ISO string
  const safeTimestampToISO = (timestamp: number | null): string | undefined => {
    try {
      if (!timestamp) return undefined;
      
      const date = timestamp > 1e10 ? new Date(timestamp) : new Date(timestamp * 1000);
      
      if (isNaN(date.getTime())) {
        return undefined;
      }
      
      return date.toISOString();
    } catch (err) {
      console.error("Error converting timestamp to ISO:", err, "Timestamp:", timestamp);
      return undefined;
    }
  };

  // Group products by batch code
  const groupProductsByBatch = (products: ProductNFT[]): BatchGroup[] => {
    const batchMap = new Map<string, BatchGroup>();

    products.forEach(product => {
      const batchCode = product.batchCode;
      
      if (batchMap.has(batchCode)) {
        const existing = batchMap.get(batchCode)!;
        existing.count += 1;
        existing.nftIds.push(product.id);
        
        // Update status to show the most critical status in the batch
        if (product.status === 'Expired' || 
            (product.status === 'Expiring Soon' && existing.status === 'Active')) {
          existing.status = product.status;
        }
      } else {
        batchMap.set(batchCode, {
          batchCode: product.batchCode,
          productName: product.productName,
          origin: product.origin,
          mintDate: product.mintDate,
          expiryDate: product.expiryDate,
          status: product.status,
          count: 1,
          nftIds: [product.id],
          firstId: product.id
        });
      }
    });

    return Array.from(batchMap.values());
  };

  const filteredBatches = groupProductsByBatch(products).filter(batch => {
    const matchesSearch = batch.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         batch.batchCode.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesFilter = filterStatus === 'All' || batch.status === filterStatus;
    return matchesSearch && matchesFilter;
  });

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'bg-green-500/20 text-green-400 border-green-500/30';
      case 'Expiring Soon':
        return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30';
      case 'Expired':
        return 'bg-red-500/20 text-red-400 border-red-500/30';
      default:
        return 'bg-gray-500/20 text-gray-400 border-gray-500/30';
    }
  };

  const getStatsFromProducts = () => {
    const batchGroups = groupProductsByBatch(products);
    const totalBatches = batchGroups.length;
    const totalProducts = products.length;
    const activeBatches = batchGroups.filter(b => b.status === 'Active').length;
    const expiringSoon = batchGroups.filter(b => b.status === 'Expiring Soon').length;
    const countries = new Set(products.map(p => p.origin).filter(origin => origin !== 'Unknown')).size;

    return { totalBatches, totalProducts, activeBatches, expiringSoon, countries };
  };

  const stats = getStatsFromProducts();

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
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold gradient-text">Brand Dashboard</h1>
              <p className="text-white/70 mt-1">Manage your product certifications</p>
              <div className="flex items-center space-x-2 mt-2">
                <Wallet size={16} className="text-green-400" />
                <span className="text-green-400 text-sm font-mono">
                  {walletInfo.address.slice(0, 6)}...{walletInfo.address.slice(-4)}
                </span>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <button
                onClick={fetchProducts}
                disabled={loading}
                className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
              >
                <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
                <span>Refresh</span>
              </button>
              <Link
                href="/product/register"
                className="gradient-purple-blue text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all duration-300 flex items-center space-x-2"
              >
                <Plus size={20} />
                <span>Add New Product</span>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          {[
            { title: "Total Batches", value: stats.totalBatches.toString(), icon: Hash, color: "from-blue-500 to-cyan-500" },
            { title: "Total Products", value: stats.totalProducts.toString(), icon: Package, color: "from-indigo-500 to-purple-500" },
            { title: "Active Batches", value: stats.activeBatches.toString(), icon: Hash, color: "from-green-500 to-emerald-500" },
            { title: "Expiring Soon", value: stats.expiringSoon.toString(), icon: Calendar, color: "from-yellow-500 to-orange-500" },
            { title: "Countries", value: stats.countries.toString(), icon: MapPin, color: "from-purple-500 to-pink-500" }
          ].map((stat, index) => (
            <motion.div
              key={stat.title}
              className="glass-card p-6 rounded-2xl"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: index * 0.1 }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-white/70 text-sm">{stat.title}</p>
                  <p className="text-3xl font-bold text-white mt-1">{stat.value}</p>
                </div>
                <div className={`w-12 h-12 bg-gradient-to-r ${stat.color} rounded-xl flex items-center justify-center`}>
                  <stat.icon className="w-6 h-6 text-white" />
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Error Display */}
        {error && (
          <motion.div
            className="glass-card p-4 rounded-2xl mb-8 border border-red-500/20"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
          >
            <div className="flex items-center space-x-3">
              <AlertCircle className="w-5 h-5 text-red-400" />
              <div>
                <p className="text-red-400 font-medium">Error loading products</p>
                <p className="text-white/70 text-sm">{error}</p>
              </div>
              <button
                onClick={fetchProducts}
                className="ml-auto px-4 py-2 bg-red-500/20 text-red-400 rounded-lg text-sm hover:bg-red-500/30 transition-all"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {/* Search and Filter */}
        <motion.div
          className="glass-card p-6 rounded-2xl mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
              <input
                type="text"
                placeholder="Search products or batch codes..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
            </div>
            <div className="relative">
              <Filter className="absolute left-3 top-1/2 transform -translate-y-1/2 text-white/50 w-5 h-5" />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pl-10 pr-8 py-3 bg-white/5 border border-white/10 rounded-xl text-white focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent appearance-none cursor-pointer"
              >
                <option value="All">All Status</option>
                <option value="Active">Active</option>
                <option value="Expiring Soon">Expiring Soon</option>
                <option value="Expired">Expired</option>
              </select>
            </div>
          </div>
        </motion.div>

        {/* Loading State */}
        {loading && (
          <motion.div
            className="glass-card p-12 rounded-2xl text-center"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
          >
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
            <p className="text-white">Loading products from blockchain...</p>
          </motion.div>
        )}

        {/* Products Table */}
        {!loading && (
          <motion.div
            className="glass-card rounded-2xl overflow-hidden"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.6 }}
          >
            <div className="p-6 border-b border-white/10">
              <h2 className="text-xl font-semibold text-white">Product Batches</h2>
              <p className="text-white/70 mt-1">{filteredBatches.length} batches found ({products.length} total products)</p>
            </div>
            
            {filteredBatches.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-white/5">
                    <tr>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Product Name</th>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Origin</th>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Batch Code</th>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Mint Date</th>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Expiry Date</th>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Count</th>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Status</th>
                      <th className="text-left py-4 px-6 text-white/80 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredBatches.map((batch, index) => (
                      <motion.tr
                        key={batch.batchCode}
                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ duration: 0.4, delay: 0.8 + index * 0.1 }}
                      >
                        <td className="py-4 px-6">
                          <div className="flex items-center space-x-3">
                            <div className="w-10 h-10 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                              <Package className="w-5 h-5 text-white" />
                            </div>
                            <span className="text-white font-medium">{batch.productName}</span>
                          </div>
                        </td>
                        <td className="py-4 px-6 text-white/80">{batch.origin}</td>
                        <td className="py-4 px-6">
                          <span className="font-mono text-sm bg-white/10 px-2 py-1 rounded text-white">
                            {batch.batchCode}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-white/80">{batch.mintDate}</td>
                        <td className="py-4 px-6 text-white/80">{batch.expiryDate}</td>
                        <td className="py-4 px-6">
                          <span className="bg-blue-500/20 text-blue-400 px-2 py-1 rounded-full text-xs font-medium">
                            {batch.count} NFT{batch.count > 1 ? 's' : ''}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <span className={`px-3 py-1 rounded-full text-xs border ${getStatusColor(batch.status)}`}>
                            {batch.status}
                          </span>
                        </td>
                        <td className="py-4 px-6">
                          <Link
                            href={`/product/${encodeURIComponent(batch.batchCode)}`}
                            className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                          >
                            View Batch
                          </Link>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Package className="w-16 h-16 text-white/30 mx-auto mb-4" />
                <h3 className="text-xl font-semibold text-white mb-2">
                  {searchTerm || filterStatus !== 'All' ? 'No batches found' : 'No product batches registered yet'}
                </h3>
                <p className="text-white/70 mb-6">
                  {searchTerm || filterStatus !== 'All' 
                    ? 'Try adjusting your search or filter criteria' 
                    : 'Start by registering your first product batch on the blockchain'}
                </p>
                <Link
                  href="/product/register"
                  className="gradient-purple-blue text-white px-6 py-3 rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all duration-300 inline-block"
                >
                  Register Your First Product
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;