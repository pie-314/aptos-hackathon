"use client";

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useParams, useRouter } from 'next/navigation';
import { ArrowLeft, Download, Printer, Copy, CheckCircle, Package, MapPin, Hash, Calendar, AlertCircle, Clock, RefreshCw } from 'lucide-react';
import Link from 'next/link';
import QRCode from 'qrcode';
import JSZip from 'jszip';
import { saveAs } from 'file-saver';

interface ProductData {
  id: string;
  productName: string;
  origin: string;
  batchCode: string;
  mintDate: string;
  expiryDate: string;
  status: string;
  used: boolean;
  firstScannedAt?: string;
  brandAddress: string;
  verificationUrl: string;
  nonce: number;
}

interface BatchData {
  batchCode: string;
  productName: string;
  origin: string;
  mintDate: string;
  expiryDate: string;
  brandAddress: string;
  products: ProductData[];
  count: number;
}

interface WalletInfo {
  address: string;
  isConnected: boolean;
}

const ProductDetails = () => {
  const params = useParams();
  const router = useRouter();
  const [batchData, setBatchData] = useState<BatchData | null>(null);
  const [qrCodeUrls, setQrCodeUrls] = useState<{ id: string; url: string }[]>([]);
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>('');
  const [walletInfo, setWalletInfo] = useState<WalletInfo | null>(null);

  // Smart contract configuration
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

  // Fetch batch details when wallet info is available
  useEffect(() => {
    if (walletInfo?.address && params.id) {
      const batchCode = decodeURIComponent(params.id as string);
      fetchBatchDetails(batchCode);
    }
  }, [walletInfo, params.id]);

  // Helper function to convert string to hex bytes
  const stringToHexBytes = (str: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return '0x' + Array.from(bytes)
      .map(byte => byte.toString(16).padStart(2, '0'))
      .join('');
  };

  // Helper function to convert bytes to string
  const bytesToString = (bytes: unknown): string => {
    try {
      if (typeof bytes === 'string') {
        // If it's already a string, return it
        if (bytes.startsWith('0x')) {
          // If it's a hex string, convert it properly
          const hex = bytes.slice(2);
          
          // Ensure even length by padding with 0 if necessary
          const paddedHex = hex.length % 2 === 0 ? hex : '0' + hex;
          
          try {
            // Convert hex pairs to bytes
            const byteArray = [];
            for (let i = 0; i < paddedHex.length; i += 2) {
              const hexPair = paddedHex.substr(i, 2);
              const byte = parseInt(hexPair, 16);
              if (!isNaN(byte)) { // Include all valid bytes, even 0
                byteArray.push(byte);
              }
            }
            
            if (byteArray.length > 0) {
              const decoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(byteArray));
              let cleaned = decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
              
              console.log('First decode result:', {
                input: bytes,
                hex: hex,
                paddedHex: paddedHex,
                byteArray: byteArray,
                decoded: decoded,
                cleaned: cleaned
              });
              
              // Check if the result is another hex string (double-encoded)
              if (cleaned.startsWith('0x')) {
                console.log("Detected double-encoded hex, decoding again...");
                const innerHex = cleaned.slice(2);
                const paddedInnerHex = innerHex.length % 2 === 0 ? innerHex : '0' + innerHex;
                
                const innerByteArray = [];
                for (let i = 0; i < paddedInnerHex.length; i += 2) {
                  const hexPair = paddedInnerHex.substr(i, 2);
                  const byte = parseInt(hexPair, 16);
                  if (!isNaN(byte)) {
                    innerByteArray.push(byte);
                  }
                }
                
                if (innerByteArray.length > 0) {
                  const finalDecoded = new TextDecoder('utf-8', { fatal: false }).decode(new Uint8Array(innerByteArray));
                  const finalCleaned = finalDecoded.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
                  
                  console.log("Double decode result:", {
                    firstDecode: cleaned,
                    innerHex: innerHex,
                    paddedInnerHex: paddedInnerHex,
                    innerByteArray: innerByteArray,
                    finalDecoded: finalDecoded,
                    finalCleaned: finalCleaned
                  });
                  
                  return finalCleaned.length > 0 ? finalCleaned : bytes;
                }
              }
              
              return cleaned.length > 0 ? cleaned : bytes;
            }
          } catch (decodeError) {
            console.warn('Failed to decode hex string:', decodeError);
            return bytes; // Return original hex string if decoding fails
          }
        }
        return bytes;
      }
      
      if (Array.isArray(bytes)) {
        // If it's an array of numbers (bytes), convert to string
        const uint8Array = new Uint8Array(bytes.filter(b => typeof b === 'number'));
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(uint8Array);
        return decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, '').trim();
      }
      
      // Fallback: convert to string
      return String(bytes || '');
    } catch (error) {
      console.warn('Failed to convert bytes to string:', error);
      return String(bytes || '');
    }
  };

  const fetchBatchDetails = async (batchCode: string) => {
    if (!walletInfo?.address) return;

    setLoading(true);
    setError('');

    try {
      console.log("Fetching batch details for batch code:", batchCode);

      // First, get the brand name for URL generation - use the wallet address as brand address
      const brandName = await fetchBrandNameAndUpdateUrls(walletInfo.address);
      console.log("Brand name for URLs:", brandName);

      // First, let's try to get all batch codes to see what's available
      const allBatchCodesResponse = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::TraceNFT::get_all_batch_codes`,
          type_arguments: [],
          arguments: [walletInfo.address]
        })
      });

      if (allBatchCodesResponse.ok) {
        const allBatchCodesData = await allBatchCodesResponse.json();
        console.log("All available batch codes:", allBatchCodesData);
        
        if (allBatchCodesData && allBatchCodesData[0] && Array.isArray(allBatchCodesData[0])) {
          const availableBatchCodes = allBatchCodesData[0].map((hexBatch: string) => {
            const decoded = bytesToString(hexBatch);
            console.log(`Decoding batch code: ${hexBatch} -> ${decoded}`);
            return decoded;
          });
          console.log("Decoded batch codes:", availableBatchCodes);
          
          // Check if our target batch code exists
          const batchExists = availableBatchCodes.includes(batchCode);
          console.log(`Batch code ${batchCode} exists:`, batchExists);
          
          if (!batchExists) {
            // Also check if the hex-encoded version matches
            const targetBatchHex = stringToHexBytes(batchCode);
            const hexBatchExists = allBatchCodesData[0].includes(targetBatchHex);
            
            console.log(`Checking hex version: ${targetBatchHex} exists: ${hexBatchExists}`);
            
            if (!hexBatchExists) {
              throw new Error(`Batch code "${batchCode}" not found. Available batches: ${availableBatchCodes.join(', ')}`);
            }
          }
        }
      }

      // Try multiple encoding approaches for the batch code
      const encodingMethods = [
        { name: 'Direct hex encoding', value: stringToHexBytes(batchCode) },
        { name: 'UTF-8 bytes', value: '0x' + Array.from(new TextEncoder().encode(batchCode)).map(b => b.toString(16).padStart(2, '0')).join('') },
        { name: 'ASCII bytes', value: '0x' + Array.from(batchCode).map(c => c.charCodeAt(0).toString(16).padStart(2, '0')).join('') }
      ];

      console.log("Trying different encoding methods for batch code:", batchCode);
      encodingMethods.forEach(method => {
        console.log(`${method.name}:`, method.value);
      });

      let productIds: string[] = [];
      let successfulMethod = '';

      // Try each encoding method
      for (const method of encodingMethods) {
        try {
          console.log(`Attempting to fetch batch products using ${method.name}...`);
          
          const batchProductsResponse = await fetch(`${DEVNET_URL}/v1/view`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              function: `0x${CONTRACT_ADDRESS}::TraceNFT::get_batch_products`,
              type_arguments: [],
              arguments: [walletInfo.address, method.value]
            })
          });

          if (batchProductsResponse.ok) {
            const batchProductsData = await batchProductsResponse.json();
            console.log(`${method.name} response:`, batchProductsData);

            if (batchProductsData && batchProductsData[0] && Array.isArray(batchProductsData[0]) && batchProductsData[0].length > 0) {
              productIds = batchProductsData[0];
              successfulMethod = method.name;
              console.log(`Success with ${method.name}! Found ${productIds.length} products`);
              break;
            }
          }
        } catch (methodError) {
          console.log(`${method.name} failed:`, methodError);
          continue;
        }
      }

      if (productIds.length === 0) {
        // Fallback: Find products by scanning all NFTs and filtering by batch code
        console.log("Fallback: Scanning all NFTs to find products in this batch...");
        
        const allNftIdsResponse = await fetch(`${DEVNET_URL}/v1/view`, {
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

        if (allNftIdsResponse.ok) {
          const allNftIdsData = await allNftIdsResponse.json();
          
          if (allNftIdsData && allNftIdsData[0] && Array.isArray(allNftIdsData[0])) {
            const allNftIds = allNftIdsData[0];
            console.log("Scanning", allNftIds.length, "NFTs for batch", batchCode);
            
            // Fetch each NFT and check its batch code
            const batchProducts: string[] = [];
            
            for (const nftId of allNftIds) {
              try {
                const nftResponse = await fetch(`${DEVNET_URL}/v1/view`, {
                  method: 'POST',
                  headers: {
                    'Content-Type': 'application/json',
                  },
                  body: JSON.stringify({
                    function: `0x${CONTRACT_ADDRESS}::TraceNFT::get_nft`,
                    type_arguments: [],
                    arguments: [walletInfo.address, nftId]
                  })
                });

                if (nftResponse.ok) {
                  const nftData = await nftResponse.json();
                  
                  if (nftData && nftData[0] && nftData[0].vec && nftData[0].vec[0]) {
                    const nft = nftData[0].vec[0];
                    const nftBatchCode = bytesToString(nft.batch_code);
                    
                    if (nftBatchCode === batchCode) {
                      batchProducts.push(nftId);
                    }
                  }
                }
              } catch (nftError) {
                console.log(`Error checking NFT ${nftId}:`, nftError);
                continue;
              }
            }
            
            if (batchProducts.length > 0) {
              productIds = batchProducts;
              successfulMethod = 'NFT scanning fallback';
              console.log(`Fallback successful! Found ${productIds.length} products in batch ${batchCode}`);
            }
          }
        }
      }

      if (productIds.length === 0) {
        throw new Error(`No products found in batch "${batchCode}". This could mean:
1. The batch code doesn't exist
2. The batch has no products
3. There's an encoding mismatch between how the batch was stored and how we're querying it`);
      }

      console.log(`Successfully found ${productIds.length} products using ${successfulMethod}`);
      console.log("Product IDs in batch:", productIds);

      // Fetch details for all products in the batch
      const productPromises = productIds.map((id: string) => 
        fetchSingleNFTDetails(walletInfo.address, id)
      );

      const productResults = await Promise.allSettled(productPromises);
      const validProducts: ProductData[] = [];

      productResults.forEach((result, index) => {
        if (result.status === 'fulfilled' && result.value) {
          // Convert hex product ID to ASCII for QR code URL
          const asciiProductId = hexToAscii(productIds[index]);
          
          // Update verification URL with actual brand name from blockchain and ASCII product ID
          const productData = {
            id: productIds[index],
            ...result.value,
            verificationUrl: `${window.location.origin}/verify/${brandName}/${asciiProductId}`
          };
          
          console.log(`🏷️ Product ${productIds[index]} QR URL: ${productData.verificationUrl}`);
          validProducts.push(productData);
        }
      });

      if (validProducts.length === 0) {
        throw new Error('No valid products found in this batch');
      }

      // Use the first product's data for batch information
      const firstProduct = validProducts[0];
      
      const batchInfo: BatchData = {
        batchCode: firstProduct.batchCode,
        productName: firstProduct.productName,
        origin: firstProduct.origin,
        mintDate: firstProduct.mintDate,
        expiryDate: firstProduct.expiryDate,
        brandAddress: firstProduct.brandAddress,
        products: validProducts,
        count: validProducts.length
      };

      setBatchData(batchInfo);

      // Generate QR codes for all products
      await generateAllQRCodes(validProducts);

      console.log("Batch details loaded successfully");

    } catch (err) {
      console.error('Error fetching batch details:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch batch details');
    } finally {
      setLoading(false);
    }
  };

  const generateAllQRCodes = async (products: ProductData[]) => {
    try {
      const qrPromises = products.map(async (product) => {
        const qrDataUrl = await QRCode.toDataURL(product.verificationUrl, {
          width: 256,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });
        return { id: product.id, url: qrDataUrl };
      });

      const qrResults = await Promise.all(qrPromises);
      setQrCodeUrls(qrResults);
    } catch (error) {
      console.error('Failed to generate QR codes:', error);
    }
  };

  // Helper function to safely parse BigInt values
  const safeParseBigInt = (value: unknown): number | null => {
    try {
      if (typeof value === 'string') {
        return parseInt(value, 10);
      }
      if (typeof value === 'number') {
        return value;
      }
      return null;
    } catch (error) {
      console.warn('Failed to parse BigInt:', error);
      return null;
    }
  };

  // Helper function to safely convert timestamp to date string
  const safeTimestampToDate = (timestamp: number): string => {
    try {
      const date = new Date(timestamp * 1000);
      return date.toLocaleDateString();
    } catch (error) {
      console.warn('Failed to convert timestamp to date:', error);
      return 'Invalid Date';
    }
  };

  // Helper function to safely convert timestamp to ISO string
  const safeTimestampToISO = (timestamp: number | null): string | undefined => {
    try {
      if (timestamp === null || timestamp === undefined) return undefined;
      const date = new Date(timestamp * 1000);
      return date.toISOString();
    } catch (error) {
      console.warn('Failed to convert timestamp to ISO:', error);
      return undefined;
    }
  };

  const fetchSingleNFTDetails = async (brandAddress: string, nftId: string): Promise<Omit<ProductData, 'id'> | null> => {
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
      return parseNFTInfo(nftData, brandAddress, nftId);

    } catch (err) {
      console.error(`Error fetching NFT ${nftId}:`, err);
      return null;
    }
  };

  // Helper function to convert hex product ID to ASCII characters for QR codes
  const hexToAscii = (hexString: string): string => {
    try {
      // Remove 0x prefix if present
      const cleanHex = hexString.startsWith('0x') ? hexString.slice(2) : hexString;
      
      // Convert hex pairs to ASCII characters
      let result = '';
      for (let i = 0; i < cleanHex.length; i += 2) {
        const hexPair = cleanHex.substr(i, 2);
        const charCode = parseInt(hexPair, 16);
        
        // Only include printable ASCII characters (32-126)
        if (charCode >= 32 && charCode <= 126) {
          result += String.fromCharCode(charCode);
        }
      }
      
      return result || hexString; // Fallback to original if no valid ASCII
    } catch (error) {
      console.warn('Failed to convert hex to ASCII:', error);
      return hexString; // Fallback to original hex string
    }
  };

  const parseNFTInfo = (nftData: unknown, brandAddress: string, nftId: string): Omit<ProductData, 'id'> | null => {
    try {
      const data = nftData as Record<string, unknown>;
      
      // Convert byte arrays to strings
      const productName = bytesToString(data.product_name);
      const origin = bytesToString(data.origin);
      const batchCode = bytesToString(data.batch_code);
      
      // Convert timestamps to dates
      const mintTimestamp = safeParseBigInt(data.mint_date);
      const expiryTimestamp = safeParseBigInt(data.expiry_date);
      
      const mintDate = mintTimestamp ? safeTimestampToDate(mintTimestamp) : 'Invalid Date';
      const expiryDate = expiryTimestamp ? safeTimestampToDate(expiryTimestamp) : 'Invalid Date';
      
      // Determine status
      const currentTime = Math.floor(Date.now() / 1000);
      const isExpired = expiryTimestamp && currentTime > expiryTimestamp;
      const isExpiringSoon = expiryTimestamp && !isExpired && (expiryTimestamp - currentTime) < (30 * 24 * 60 * 60);
      
      let status = 'Active';
      if (data.used) {
        status = 'Used';
      } else if (isExpired) {
        status = 'Expired';
      } else if (isExpiringSoon) {
        status = 'Expiring Soon';
      }

      // Convert hex product ID to ASCII for QR code URL
      const asciiProductId = hexToAscii(nftId);
      
      // Create verification URL with ASCII product ID
      const verificationUrl = `${window.location.origin}/verify/BRAND_NAME_PLACEHOLDER/${asciiProductId}`;

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
          : undefined,
        brandAddress,
        verificationUrl,
        nonce: safeParseBigInt(data.nonce) || 0
      };

    } catch (err) {
      console.error("Error parsing NFT info:", err, "Data:", nftData);
      return null;
    }
  };

  // Enhanced function to fetch brand name and update URLs
  const fetchBrandNameAndUpdateUrls = async (brandAddress: string): Promise<string> => {
    try {
      console.log(`🔍 Fetching actual brand name for address: ${brandAddress}`);
      
      // Clean and format the address properly for Aptos
      const cleanAddress = brandAddress.startsWith('0x') ? brandAddress.slice(2) : brandAddress;
      const formattedBrandAddress = `0x${cleanAddress}`;
      
      console.log(`📝 Formatted brand address: ${formattedBrandAddress}`);
      
      // First check if the brand is registered
      const isRegistered = await checkBrandRegistration(formattedBrandAddress);
      console.log(`Brand registration status for ${formattedBrandAddress}:`, isRegistered);
      
      if (!isRegistered) {
        console.log("⚠️ Brand address is not registered in the system");
        const fallback = `brand-${cleanAddress.slice(0, 6)}`;
        console.log("🔄 Using fallback brand identifier:", fallback);
        return fallback;
      }
      
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::BrandRegistry::get_brand_name`,
          type_arguments: [],
          arguments: [`0x${CONTRACT_ADDRESS}`, formattedBrandAddress]
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log("📋 Brand name response for", formattedBrandAddress, ":", data);
        
        // Handle Option<vector<u8>> return type
        // The response structure for Option is: [{"vec": [actual_data]}] for Some, [{"vec": []}] for None
        if (data && Array.isArray(data) && data[0]) {
          const optionData = data[0];
          
          // Check if this is Some(value) - vec array has content
          if (optionData.vec && Array.isArray(optionData.vec) && optionData.vec.length > 0) {
            const brandNameBytes = optionData.vec[0];
            let brandName = bytesToString(brandNameBytes);
            
            console.log("🏷️ Raw brand name from blockchain:", brandName);
            
            // Validate that we got a real brand name, not just empty or default values
            if (brandName && 
                brandName.trim().length > 0 && 
                brandName !== 'Unknown' && 
                brandName !== 'undefined' && 
                brandName !== 'null') {
              
              // Clean brand name for URL usage (remove special characters, spaces)
              // const cleanBrandName = brandName.replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
              
              // console.log("🧹 Cleaned brand name for URL:", cleanBrandName);
              
              if (brandName.length > 0) {
                console.log("✅ Using fetched brand name for QR URLs:", brandName);
                
                // Log sample QR URL format
                console.log(`📱 QR URLs will be: ${window.location.origin}/verify/${brandName}/[product-id]`);
                
                return brandName;
              }
            }
            
            console.log("❌ Brand name is empty, invalid, or default value");
          } else {
            console.log("❌ Brand name returned None (empty vec)");
          }
        } else {
          console.log("❌ Invalid response structure for Option type");
        }
      } else {
        console.log("❌ Brand name fetch failed:", response.status, response.statusText);
        
        // Try to get more details about the error
        try {
          const errorText = await response.text();
          console.log("Error details:", errorText);
        } catch (e) {
          console.log("Could not read error details");
        }
      }
    } catch (error) {
      console.warn('Failed to fetch brand name:', error);
    }
    
    // Fallback: use shortened address format
    const cleanAddress = brandAddress.startsWith('0x') ? brandAddress.slice(2) : brandAddress;
    const fallback = `brand-${cleanAddress.slice(0, 6)}`;
    console.log("🔄 Using fallback brand identifier:", fallback);
    console.log(`📱 Fallback QR URLs will be: ${window.location.origin}/verify/${fallback}/[product-id]`);
    
    return fallback;
  };

  // Helper function to check if brand is registered
  const checkBrandRegistration = async (brandAddress: string): Promise<boolean> => {
    try {
      // Clean and format the address properly for Aptos
      const cleanAddress = brandAddress.startsWith('0x') ? brandAddress.slice(2) : brandAddress;
      const formattedBrandAddress = `0x${cleanAddress}`;
      
      console.log(`🔍 Checking registration for formatted address: ${formattedBrandAddress}`);
      
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          function: `0x${CONTRACT_ADDRESS}::BrandRegistry::is_registered`,
          type_arguments: [],
          arguments: [`0x${CONTRACT_ADDRESS}`, formattedBrandAddress]
        })
      });

      if (response.ok) {
        const data = await response.json();
        // The response for boolean is simply [true] or [false]
        const isRegistered = Array.isArray(data) && data[0] === true;
        console.log(`✅ Brand registration status for ${formattedBrandAddress}:`, isRegistered);
        return isRegistered;
      } else {
        console.log("❌ Registration check failed:", response.status, response.statusText);
        
        // Try to get more details about the error
        try {
          const errorText = await response.text();
          console.log("Registration check error details:", errorText);
        } catch (e) {
          console.log("Could not read registration error details");
        }
      }
    } catch (error) {
      console.warn('Failed to check brand registration:', error);
    }
    
    return false;
  };

  const copyToClipboard = async (text: string) => {
    try {
      // Check if navigator.clipboard is available
      if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      }

      // Fallback method for older browsers or non-HTTPS environments
      const textArea = document.createElement('textarea');
      textArea.value = text;
      textArea.style.position = 'fixed';
      textArea.style.left = '-999999px';
      textArea.style.top = '-999999px';
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      try {
        const successful = document.execCommand('copy');
        if (successful) {
          setCopied(true);
          setTimeout(() => setCopied(false), 2000);
        } else {
          throw new Error('Copy command failed');
        }
      } catch (fallbackError) {
        console.error('Fallback copy failed:', fallbackError);
        // Show a simple alert as last resort
        prompt('Copy this text manually:', text);
      } finally {
        document.body.removeChild(textArea);
      }
    } catch (error) {
      console.error('Failed to copy:', error);
      // Show a simple alert as last resort
      try {
        prompt('Copy this text manually:', text);
      } catch (promptError) {
        console.error('Even prompt failed:', promptError);
        // Create a temporary div with the text for manual selection
        const tempDiv = document.createElement('div');
        tempDiv.style.position = 'fixed';
        tempDiv.style.top = '50%';
        tempDiv.style.left = '50%';
        tempDiv.style.transform = 'translate(-50%, -50%)';
        tempDiv.style.background = 'white';
        tempDiv.style.color = 'black';
        tempDiv.style.padding = '20px';
        tempDiv.style.border = '2px solid black';
        tempDiv.style.zIndex = '9999';
        tempDiv.innerHTML = `
          <p>Please copy this text manually:</p>
          <textarea readonly style="width: 100%; height: 100px;">${text}</textarea>
          <button onclick="this.parentElement.remove()">Close</button>
        `;
        document.body.appendChild(tempDiv);
      }
    }
  };

  const downloadAllQRCodes = async () => {
    if (!batchData || qrCodeUrls.length === 0) return;

    try {
      const zip = new JSZip();
      
      // Add each QR code to the zip
      for (const qrData of qrCodeUrls) {
        const product = batchData.products.find(p => p.id === qrData.id);
        if (!product) continue;

        // Generate higher resolution QR code for download
        const highResQR = await QRCode.toDataURL(product.verificationUrl, {
          width: 512,
          margin: 2,
          color: {
            dark: '#000000',
            light: '#FFFFFF'
          }
        });

        // Convert data URL to blob
        const base64Data = highResQR.split(',')[1];
        const binaryData = atob(base64Data);
        const bytes = new Uint8Array(binaryData.length);
        for (let j = 0; j < binaryData.length; j++) {
          bytes[j] = binaryData.charCodeAt(j);
        }

        // Add to zip with descriptive filename
        const filename = `${batchData.batchCode}_${product.id}_QR.png`;
        zip.file(filename, bytes);
      }

      // Add a summary text file
      const summaryContent = `Batch: ${batchData.batchCode}
Product: ${batchData.productName}
Origin: ${batchData.origin}
Mint Date: ${batchData.mintDate}
Expiry Date: ${batchData.expiryDate}
Total Products: ${batchData.count}

Product IDs:
${batchData.products.map(p => `- ${p.id} (Status: ${p.status})`).join('\n')}

Generated on: ${new Date().toISOString()}`;

      zip.file(`${batchData.batchCode}_summary.txt`, summaryContent);

      // Generate and download zip file
      const content = await zip.generateAsync({ type: 'blob' });
      saveAs(content, `${batchData.batchCode}_QR_Codes.zip`);

    } catch (error) {
      console.error('Failed to generate zip file:', error);
      setError('Failed to download QR codes. Please try again.');
    }
  };

  const printAllQRCodes = () => {
    if (!batchData || qrCodeUrls.length === 0) return;

    const printWindow = window.open('', '_blank');
    if (printWindow) {
      let qrImagesHtml = '';
      qrCodeUrls.forEach((qrData) => {
        const product = batchData.products.find(p => p.id === qrData.id);
        if (product) {
          qrImagesHtml += `
            <div class="qr-item">
              <h3>${product.productName}</h3>
              <p><strong>ID:</strong> ${product.id}</p>
              <img src="${qrData.url}" alt="QR Code for ${product.id}" />
              <p><strong>Status:</strong> ${product.status}</p>
              <p><strong>Batch:</strong> ${product.batchCode}</p>
            </div>
          `;
        }
      });

      printWindow.document.write(`
        <html>
          <head>
            <title>Batch QR Codes - ${batchData.productName}</title>
            <style>
              body { 
                font-family: Arial, sans-serif; 
                padding: 20px; 
              }
              .header {
                text-align: center;
                margin-bottom: 30px;
                border-bottom: 2px solid #333;
                padding-bottom: 20px;
              }
              .qr-item {
                margin: 30px 0;
                page-break-inside: avoid;
                text-align: center;
                border: 1px solid #ddd;
                padding: 20px;
                border-radius: 8px;
              }
              img { 
                max-width: 200px; 
                height: auto; 
                margin: 15px 0;
                border: 1px solid #eee;
              }
              h3 { 
                margin: 10px 0; 
                color: #333;
              }
              p { 
                margin: 5px 0; 
                font-size: 14px;
              }
              .grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
              }
            </style>
          </head>
          <body>
            <div class="header">
              <h1>Batch QR Codes: ${batchData.productName}</h1>
              <p><strong>Batch Code:</strong> ${batchData.batchCode}</p>
              <p><strong>Origin:</strong> ${batchData.origin}</p>
              <p><strong>Total Products:</strong> ${batchData.count}</p>
              <p><strong>Mint Date:</strong> ${batchData.mintDate}</p>
              <p><strong>Expiry Date:</strong> ${batchData.expiryDate}</p>
            </div>
            <div class="grid">
              ${qrImagesHtml}
            </div>
            <p style="text-align: center; margin-top: 30px;"><small>Scan any QR code to verify product authenticity on TraceChain</small></p>
          </body>
        </html>
      `);
      printWindow.document.close();
      printWindow.print();
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'Active':
        return 'text-green-400 bg-green-500/20';
      case 'Expiring Soon':
        return 'text-yellow-400 bg-yellow-500/20';
      case 'Expired':
        return 'text-red-400 bg-red-500/20';
      case 'Used':
        return 'text-gray-400 bg-gray-500/20';
      default:
        return 'text-gray-400 bg-gray-500/20';
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

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center">
          <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <p>Loading batch details from blockchain...</p>
        </div>
      </div>
    );
  }

  if (error || !batchData) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <div className="text-white text-center max-w-2xl mx-auto px-4">
          <AlertCircle className="w-16 h-16 text-red-400 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Error Loading Batch</h2>
          <p className="text-white/70 mb-6">
            {error || "The batch you're looking for doesn't exist or you don't have access to it."}
          </p>
          
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button
              onClick={() => fetchBatchDetails(params.id as string)}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Retry</span>
            </button>
            <Link href="/dashboard" className="gradient-purple-blue text-white px-6 py-3 rounded-xl">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link 
                href="/dashboard"
                className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Back to Dashboard</span>
              </Link>
            </div>
            <button
              onClick={() => fetchBatchDetails(params.id as string)}
              disabled={loading}
              className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg hover:bg-white/20 transition-all duration-300 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
              <span>Refresh</span>
            </button>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold gradient-text">Batch Certificate</h1>
            <p className="text-white/70 mt-1">
              Blockchain-verified batch with {batchData.count} products
            </p>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Batch Details */}
          <motion.div
            className="glass-card p-8 rounded-2xl"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Batch Information</h2>
            
            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <Package className="w-5 h-5 text-purple-400 mt-1" />
                <div>
                  <p className="text-white/70 text-sm">Product Name</p>
                  <p className="text-white font-semibold">{batchData.productName}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-green-400 mt-1" />
                <div>
                  <p className="text-white/70 text-sm">Origin</p>
                  <p className="text-white font-semibold">{batchData.origin}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Hash className="w-5 h-5 text-blue-400 mt-1" />
                <div>
                  <p className="text-white/70 text-sm">Batch Code</p>
                  <p className="text-white font-semibold font-mono">{batchData.batchCode}</p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-orange-400 mt-1" />
                  <div>
                    <p className="text-white/70 text-sm">Mint Date</p>
                    <p className="text-white font-semibold">{batchData.mintDate}</p>
                  </div>
                </div>

                <div className="flex items-start space-x-3">
                  <Calendar className="w-5 h-5 text-red-400 mt-1" />
                  <div>
                    <p className="text-white/70 text-sm">Expiry Date</p>
                    <p className="text-white font-semibold">{batchData.expiryDate}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <p className="text-white/70 text-sm mb-2">Batch Statistics</p>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-white/60 text-xs">Total Products</p>
                    <p className="text-white font-bold text-lg">{batchData.count}</p>
                  </div>
                  <div>
                    <p className="text-white/60 text-xs">QR Codes Generated</p>
                    <p className="text-white font-bold text-lg">{qrCodeUrls.length}</p>
                  </div>
                </div>
              </div>

              <div className="border-t border-white/10 pt-6">
                <p className="text-white/70 text-sm mb-2">Brand Address</p>
                <div className="flex items-center space-x-2">
                  <p className="text-white font-mono text-sm">{batchData.brandAddress}</p>
                  <button
                    onClick={() => copyToClipboard(batchData.brandAddress)}
                    className="text-white/60 hover:text-white transition-colors"
                  >
                    {copied ? <CheckCircle size={16} /> : <Copy size={16} />}
                  </button>
                </div>
              </div>
            </div>
          </motion.div>

          {/* QR Codes Section */}
          <motion.div
            className="glass-card p-8 rounded-2xl"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h2 className="text-2xl font-bold text-white mb-6">Verification QR Codes</h2>
            
            {qrCodeUrls.length > 0 ? (
              <div className="space-y-6">
                {/* Show first 6 QR codes in a grid */}
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  {qrCodeUrls.slice(0, 6).map((qrData, index) => {
                    const product = batchData.products.find(p => p.id === qrData.id);
                    return (
                      <div key={qrData.id} className="bg-white p-3 rounded-xl">
                        <img 
                          src={qrData.url} 
                          alt={`QR Code for ${qrData.id}`} 
                          className="w-full h-auto mx-auto"
                        />
                        <p className="text-black text-xs mt-2 font-mono text-center">
                          {qrData.id}
                        </p>
                        {product && (
                          <div className={`text-center mt-1 px-2 py-1 rounded text-xs ${getStatusColor(product.status)}`}>
                            {product.status}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                
                {batchData.count > 6 && (
                  <p className="text-white/70 text-sm text-center">
                    Showing 6 of {batchData.count} QR codes.
                    <br />Download all to get complete batch QR codes.
                  </p>
                )}

                <p className="text-white/70 text-sm text-center">
                  Scan any QR code to verify individual product authenticity
                </p>

                <div className="flex flex-col sm:flex-row gap-4 justify-center">
                  <motion.button
                    onClick={downloadAllQRCodes}
                    className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Download size={18} />
                    <span>Download All ({batchData.count} QR Codes)</span>
                  </motion.button>

                  <motion.button
                    onClick={printAllQRCodes}
                    className="flex items-center space-x-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-all duration-300"
                    whileHover={{ scale: 1.05 }}
                    whileTap={{ scale: 0.95 }}
                  >
                    <Printer size={18} />
                    <span>Print All</span>
                  </motion.button>
                </div>

                <div className="bg-white/5 p-4 rounded-xl">
                  <p className="text-white/70 text-sm">
                    <strong>Batch Information:</strong>
                  </p>
                  <div className="text-white text-sm font-mono mt-2 space-y-1">
                    <p>Batch Code: {batchData.batchCode}</p>
                    <p>Total Products: {batchData.count}</p>
                    <p>Product Type: {batchData.productName}</p>
                    <p>Origin: {batchData.origin}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center text-white/70">
                <p>Generating QR codes...</p>
              </div>
            )}
          </motion.div>
        </div>

        {/* Products List */}
        <motion.div
          className="glass-card rounded-2xl overflow-hidden mt-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <div className="p-6 border-b border-white/10">
            <h2 className="text-xl font-semibold text-white">Products in this Batch</h2>
            <p className="text-white/70 mt-1">{batchData.products.length} products found</p>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-white/5">
                <tr>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">Product ID</th>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">Status</th>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">Used</th>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">First Scanned</th>
                  <th className="text-left py-4 px-6 text-white/80 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {batchData.products.map((product, index) => (
                  <motion.tr
                    key={product.id}
                    className="border-b border-white/5 hover:bg-white/5 transition-colors"
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.4, delay: 0.6 + index * 0.05 }}
                  >
                    <td className="py-4 px-6">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 bg-gradient-to-r from-purple-500 to-blue-500 rounded-lg flex items-center justify-center">
                          <Hash className="w-4 h-4 text-white" />
                        </div>
                        <span className="font-mono text-sm text-white">{product.id}</span>
                      </div>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-3 py-1 rounded-full text-xs ${getStatusColor(product.status)}`}>
                        {product.status}
                      </span>
                    </td>
                    <td className="py-4 px-6">
                      <span className={`px-2 py-1 rounded-full text-xs ${
                        product.used 
                          ? 'bg-red-500/20 text-red-400' 
                          : 'bg-green-500/20 text-green-400'
                      }`}>
                        {product.used ? 'Used' : 'Available'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-white/80">
                      {product.firstScannedAt 
                        ? new Date(product.firstScannedAt).toLocaleDateString()
                        : 'Never'
                      }
                    </td>
                    <td className="py-4 px-6">
                      <button
                        onClick={() => copyToClipboard(product.verificationUrl)}
                        className="text-purple-400 hover:text-purple-300 text-sm transition-colors"
                      >
                        Copy URL
                      </button>
                    </td>
                  </motion.tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default ProductDetails;