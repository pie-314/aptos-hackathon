"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useParams } from "next/navigation";
import {
  ArrowLeft,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Package,
  MapPin,
  Calendar,
  Hash,
  Shield,
  Building,
  Clock,
  Scan,
  RefreshCw,
  Coins,
  User,
} from "lucide-react";
import Link from "next/link";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import AuthModal from "@/components/auth-model";
import TokenClaimingSection from "@/components/token-claiming-section"

interface ProductVerification {
  id: string;
  productName: string;
  brandName: string;
  brandAddress: string;
  origin: string;
  batchCode: string;
  mintDate: string;
  expiryDate: string;
  status: "verified" | "expired" | "invalid" | "used" | "scan_expired";
  verificationDate: string;
  certificationLevel: "Premium" | "Standard" | "Basic";
  brandVerified: boolean;
  totalScans: number;
  lastScanned: string;
  used: boolean;
  firstScannedAt?: string;
  isValid: boolean;
  validationMessage: string;
  nonce: number;
}

interface NFTInfo {
  product_name: string | { data: number[] };
  origin: string | { data: number[] };
  batch_code: string | { data: number[] };
  mint_date: string | number;
  expiry_date: string | number;
  used: boolean;
  first_scanned_at?: { vec?: [string | number] };
  nonce: string | number;
}

interface StatusConfig {
  icon: React.ComponentType<{ className?: string; size?: number }>;
  color: string;
  bgColor: string;
  borderColor: string;
  title: string;
  message: string;
  iconBg: string;
}

const VerifyProduct = () => {
  const params = useParams();
  const [product, setProduct] = useState<ProductVerification | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");
  const [isLoggedIn, setIsLoggedIn] = useState(false);
  const [tokenCount, setTokenCount] = useState(0);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string>("");

  // Smart contract configuration
  const CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  const DEVNET_URL = "https://fullnode.devnet.aptoslabs.com";

  const supabase = createClientComponentClient();

  useEffect(() => {
    checkAuthStatus();
  }, []);

  useEffect(() => {
    if (params.brand && params.product_id) {
      fetchAndVerifyProduct();
    }
  }, [params.brand, params.product_id]);

  const checkAuthStatus = async () => {
    try {
      // Check wallet connection first
      const walletAddress = localStorage.getItem("walletAddress");
      const isWalletConnected =
        localStorage.getItem("isWalletConnected") === "true";

      if (walletAddress && isWalletConnected) {
        // User connected via wallet
        const { data: user, error } = await supabase
          .from("users")
          .select("*")
          .eq("wallet_address", walletAddress)
          .single();

        if (user && !error) {
          setIsLoggedIn(true);
          setTokenCount(parseInt(user.token) || 0);
          setUserEmail(user.email || "");
        }
      } else {
        // Check Supabase session for email auth
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (session?.user) {
          const { data: user, error } = await supabase
            .from("users")
            .select("*")
            .eq("id", session.user.id)
            .single();

          if (user && !error) {
            setIsLoggedIn(true);
            setTokenCount(parseInt(user.token) || 0);
            setUserEmail(user.email || "");
          }
        }
      }
    } catch (error) {
      console.error("Error checking auth status:", error);
    }
  };

  const handleAuthSuccess = async (
    user: any,
    authMethod: "email" | "wallet"
  ) => {
    setIsLoggedIn(true);
    setShowAuthModal(false);

    try {
      let userData;

      if (authMethod === "wallet") {
        // For wallet auth, user is already the database record
        userData = user;
      } else {
        // For email auth, fetch the user record from database
        const { data, error } = await supabase
          .from("users")
          .select("*")
          .eq("id", user.id)
          .single();

        if (data && !error) {
          userData = data;
        }
      }

      if (userData) {
        setTokenCount(parseInt(userData.token) || 0);
        setUserEmail(userData.email || "");
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const handleLogout = async () => {
    try {
      // Clear wallet connection
      localStorage.removeItem("walletAddress");
      localStorage.removeItem("isWalletConnected");

      // Sign out from Supabase
      await supabase.auth.signOut();

      setIsLoggedIn(false);
      setTokenCount(0);
      setUserEmail("");
    } catch (error) {
      console.error("Error during logout:", error);
    }
  };

  // Add function to resolve brand name to address using the smart contract
  const resolveBrandNameToAddress = async (
    brandNameOrAddress: string
  ): Promise<string | null> => {
    // If it's already an address (starts with 0x), return it
    if (brandNameOrAddress.startsWith("0x")) {
      return brandNameOrAddress;
    }

    // If it's a fallback format (brand-xxxxxx), extract the address part and reconstruct full address
    if (brandNameOrAddress.startsWith("brand-")) {
      const addressPart = brandNameOrAddress.substring(6); // Remove 'brand-'
      // This is a fallback format, we'll need to try to find the full address
      console.log("Fallback brand format detected:", brandNameOrAddress);

      // For fallback format, we don't have enough info to reconstruct the full address
      // We'll return null and let the caller handle it
      return null;
    }

    // Use the smart contract to resolve brand name to address
    try {
      console.log(
        "Resolving brand name to address using smart contract:",
        brandNameOrAddress
      );

      // Convert brand name to bytes for the contract call
      const brandNameBytes = stringToHexBytes(brandNameOrAddress);
      console.log("Brand name as hex bytes:", brandNameBytes);

      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          function: `${CONTRACT_ADDRESS}::BrandRegistry::get_brand_address`,
          type_arguments: [],
          arguments: [`0x${CONTRACT_ADDRESS}`, brandNameBytes],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Brand address resolution response:", data);

        // Handle Option<address> return type
        if (data && Array.isArray(data) && data[0]) {
          const optionData = data[0];

          // Check if this is Some(value) - vec array has content
          if (
            optionData.vec &&
            Array.isArray(optionData.vec) &&
            optionData.vec.length > 0
          ) {
            const brandAddress = optionData.vec[0];
            console.log("✅ Resolved brand address:", brandAddress);
            return brandAddress;
          } else {
            console.log("❌ Brand name not found in registry (empty vec)");
            return null;
          }
        } else {
          console.log(
            "❌ Invalid response structure for brand address resolution"
          );
          return null;
        }
      } else {
        console.log(
          "❌ Brand address resolution failed:",
          response.status,
          response.statusText
        );

        // Try to get more details about the error
        try {
          const errorText = await response.text();
          console.log("Error details:", errorText);
        } catch (e) {
          console.log("Could not read error details");
        }
        return null;
      }
    } catch (error) {
      console.warn("Failed to resolve brand name to address:", error);
      return null;
    }
  };

  // Helper function to convert string to hex bytes
  const stringToHexBytes = (str: string): string => {
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    return (
      "0x" +
      Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")
    );
  };

  // Helper function to convert ASCII product ID back to hex for blockchain operations
  const asciiToHex = (asciiString: string): string => {
    try {
      // If it's already a hex string, return it as is
      if (asciiString.startsWith("0x")) {
        return asciiString;
      }

      // Convert ASCII characters to hex
      let hexString = "0x";
      for (let i = 0; i < asciiString.length; i++) {
        const charCode = asciiString.charCodeAt(i);
        hexString += charCode.toString(16).padStart(2, "0");
      }

      return hexString;
    } catch (error) {
      console.warn("Failed to convert ASCII to hex:", error);
      return asciiString; // Fallback to original string
    }
  };

  const fetchAndVerifyProduct = async () => {
    setLoading(true);
    setError("");

    try {
      const brandParam = params.brand as string;
      const productIdParam = params.product_id as string;

      console.log("Verifying product:", { brandParam, productIdParam });

      // Convert ASCII product ID back to hex for blockchain operations
      const productId = asciiToHex(productIdParam);
      console.log("Product ID conversion:", {
        original: productIdParam,
        hex: productId,
      });

      // Try to resolve brand name to address using the smart contract
      let brandAddress = await resolveBrandNameToAddress(brandParam);

      // If we couldn't resolve it through the contract, handle different cases
      if (!brandAddress) {
        if (brandParam.startsWith("0x")) {
          // It's already an address but wasn't caught earlier
          brandAddress = brandParam;
        } else if (brandParam.startsWith("brand-")) {
          // This is a fallback format - we need to find the actual address
          // For now, we'll show a more helpful error message
          throw new Error(
            `The QR code contains a fallback brand identifier "${brandParam}". This might mean the brand name could not be resolved when the QR code was generated. Please contact the brand or scan a newer QR code.`
          );
        } else {
          // Brand name not found in registry
          throw new Error(
            `Brand "${brandParam}" is not registered in the system. Please verify that this is a legitimate product from a registered brand.`
          );
        }
      }

      console.log("Resolved brand address:", brandAddress);

      // Step 1: Check if product exists
      const nftResponse = await fetch(`${DEVNET_URL}/v1/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          function: `${CONTRACT_ADDRESS}::TraceNFT::get_nft`,
          type_arguments: [],
          arguments: [brandAddress, productId],
        }),
      });

      if (!nftResponse.ok) {
        throw new Error("Failed to fetch product from blockchain");
      }

      const nftData = await nftResponse.json();
      console.log("NFT response:", nftData);

      if (
        !nftData ||
        !nftData[0] ||
        !nftData[0].vec ||
        nftData[0].vec.length === 0
      ) {
        throw new Error("Product not found or does not exist");
      }

      const nftInfo: NFTInfo = nftData[0].vec[0];
      console.log("NFT info:", nftInfo);

      // Step 2: Fetch brand name from BrandRegistry (we already know the address)
      const brandName = await fetchBrandName(brandAddress);

      // Step 3: Verify authenticity using the VerifyNFT module
      const currentTime = Math.floor(Date.now() / 1000);

      const verifyResponse = await fetch(`${DEVNET_URL}/v1/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          function: `${CONTRACT_ADDRESS}::VerifyNFT::verify_authenticity`,
          type_arguments: [],
          arguments: [brandAddress, productId, currentTime.toString()],
        }),
      });

      let isValid = false;
      let validationMessage = "Unknown verification status";

      if (verifyResponse.ok) {
        const verifyData = await verifyResponse.json();
        console.log("Verification response:", verifyData);

        if (verifyData && verifyData[0] !== undefined && verifyData[1]) {
          isValid = verifyData[0];
          // Convert byte array message to string
          const messageBytes = verifyData[1];
          validationMessage = bytesToString(messageBytes);
        }
      } else {
        console.warn(
          "Verification check failed, proceeding with basic validation"
        );
        // Fallback validation
        const expiryTimestamp = safeParseBigInt(nftInfo.expiry_date);
        isValid =
          !nftInfo.used &&
          expiryTimestamp !== null &&
          currentTime <= expiryTimestamp;
        validationMessage = isValid
          ? "Valid product"
          : "Product expired or used";
      }

      console.log("Verification result:", { isValid, validationMessage });

      // Step 4: Parse product data with brand name (use original hex productId for blockchain data)
      const productData = parseProductData(
        nftInfo,
        productId,
        brandAddress,
        brandName,
        isValid,
        validationMessage,
        currentTime
      );

      if (!productData) {
        throw new Error("Failed to parse product data");
      }

      setProduct(productData);
    } catch (err) {
      console.error("Verification failed:", err);
      setError(err instanceof Error ? err.message : "Failed to verify product");
    } finally {
      setLoading(false);
    }
  };

  // Updated function to fetch brand name from BrandRegistry
  const fetchBrandName = async (brandAddress: string): Promise<string> => {
    try {
      const response = await fetch(`${DEVNET_URL}/v1/view`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          function: `${CONTRACT_ADDRESS}::BrandRegistry::get_brand_name`,
          type_arguments: [],
          arguments: [`0x${CONTRACT_ADDRESS}`, brandAddress],
        }),
      });

      if (response.ok) {
        const data = await response.json();
        console.log("Brand name response:", data);

        // Handle Option<vector<u8>> return type
        if (data && Array.isArray(data) && data[0]) {
          const optionData = data[0];

          // Check if this is Some(value) - vec array has content
          if (
            optionData.vec &&
            Array.isArray(optionData.vec) &&
            optionData.vec.length > 0
          ) {
            const brandNameBytes = optionData.vec[0];
            const brandName = bytesToString(brandNameBytes);
            console.log("Fetched brand name:", brandName);

            // Validate that we got a real brand name
            if (
              brandName &&
              brandName.trim().length > 0 &&
              brandName !== "Unknown" &&
              brandName !== "undefined" &&
              brandName !== "null"
            ) {
              return brandName;
            }
          }
        }
      }
    } catch (error) {
      console.warn("Failed to fetch brand name:", error);
    }

    // Fallback to address format
    return `Brand (${brandAddress.slice(0, 6)}...${brandAddress.slice(-4)})`;
  };

  const parseProductData = (
    nftInfo: NFTInfo,
    id: string,
    brandAddress: string,
    brandName: string, // Updated to receive brandName as parameter
    isValid: boolean,
    validationMessage: string,
    currentTime: number
  ): ProductVerification | null => {
    try {
      // Convert byte arrays to strings
      const productName = bytesToString(nftInfo.product_name);
      const origin = bytesToString(nftInfo.origin);
      const batchCode = bytesToString(nftInfo.batch_code);

      // Convert timestamps
      const mintTimestamp = safeParseBigInt(nftInfo.mint_date);
      const expiryTimestamp = safeParseBigInt(nftInfo.expiry_date);

      const mintDate = mintTimestamp
        ? safeTimestampToDate(mintTimestamp)
        : "Invalid Date";
      const expiryDate = expiryTimestamp
        ? safeTimestampToDate(expiryTimestamp)
        : "Invalid Date";

      // Determine overall status
      let status: ProductVerification["status"] = "verified";

      if (nftInfo.used) {
        status = "used";
      } else if (expiryTimestamp && currentTime > expiryTimestamp) {
        status = "expired";
      } else if (!isValid) {
        if (
          validationMessage.includes("scan") ||
          validationMessage.includes("24 hours")
        ) {
          status = "scan_expired";
        } else {
          status = "invalid";
        }
      }

      // Get first scanned timestamp
      const firstScannedTimestamp = nftInfo.first_scanned_at?.vec?.[0]
        ? safeParseBigInt(nftInfo.first_scanned_at.vec[0])
        : null;

      const firstScannedAt = firstScannedTimestamp
        ? safeTimestampToISO(firstScannedTimestamp)
        : undefined;

      return {
        id,
        productName,
        brandName, // Use the fetched brand name
        brandAddress,
        origin,
        batchCode,
        mintDate,
        expiryDate,
        status,
        verificationDate: new Date().toISOString(),
        certificationLevel: "Premium",
        brandVerified: true,
        totalScans: firstScannedAt ? 1 : 0, // Simplified count
        lastScanned: firstScannedAt || new Date().toISOString(),
        used: nftInfo.used || false,
        firstScannedAt,
        isValid,
        validationMessage,
        nonce: safeParseBigInt(nftInfo.nonce) || 0,
      };
    } catch (parseError) {
      console.error("Error parsing product data:", parseError);
      return null;
    }
  };

  // Helper function to convert bytes to string
  const bytesToString = (
    byteData: string | { data: number[] } | number[]
  ): string => {
    try {
      if (!byteData) return "Unknown";

      const bytes: number[] = [];

      // Handle hex string format (new format from the updated contract)
      if (typeof byteData === "string" && byteData.startsWith("0x")) {
        const hexString = byteData.slice(2); // Remove '0x' prefix
        console.log("Processing hex string:", hexString);

        // Ensure even length by padding with 0 if necessary
        const paddedHex =
          hexString.length % 2 === 0 ? hexString : "0" + hexString;

        // Convert hex pairs to bytes
        for (let i = 0; i < paddedHex.length; i += 2) {
          const hexPair = paddedHex.substr(i, 2);
          const byte = parseInt(hexPair, 16);
          if (!isNaN(byte) && byte > 0) {
            // Skip null bytes
            bytes.push(byte);
          }
        }

        // First decode attempt
        if (bytes.length > 0) {
          try {
            const firstDecode = new TextDecoder("utf-8", {
              fatal: false,
            }).decode(new Uint8Array(bytes));
            console.log("First decode result:", firstDecode);

            // Check if the result is another hex string (double-encoded)
            if (firstDecode.startsWith("0x")) {
              console.log("Detected double-encoded hex, decoding again...");
              const innerHex = firstDecode.slice(2);
              const innerBytes: number[] = [];

              // Ensure even length
              const paddedInnerHex =
                innerHex.length % 2 === 0 ? innerHex : "0" + innerHex;

              // Convert inner hex pairs to bytes
              for (let i = 0; i < paddedInnerHex.length; i += 2) {
                const hexPair = paddedInnerHex.substr(i, 2);
                const byte = parseInt(hexPair, 16);
                if (!isNaN(byte) && byte > 0) {
                  innerBytes.push(byte);
                }
              }

              if (innerBytes.length > 0) {
                const finalResult = new TextDecoder("utf-8", {
                  fatal: false,
                }).decode(new Uint8Array(innerBytes));
                const cleaned = finalResult
                  .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
                  .trim();

                console.log("Double decode result:", {
                  firstDecode,
                  innerHex,
                  innerBytes: innerBytes.slice(0, 10),
                  finalResult,
                  cleaned,
                });

                return cleaned.length > 0 ? cleaned : "Unknown";
              }
            } else {
              // Single decode was sufficient
              const cleaned = firstDecode
                .replace(/[\x00-\x1F\x7F-\x9F]/g, "")
                .trim();
              return cleaned.length > 0 ? cleaned : "Unknown";
            }
          } catch (decodeError) {
            console.warn("Decode failed:", decodeError);
          }
        }
      }

      // Handle array format
      if (Array.isArray(byteData)) {
        const processedBytes = byteData
          .map((item) =>
            typeof item === "number" ? item : parseInt(String(item), 10)
          )
          .filter((byte) => !isNaN(byte) && byte > 0);

        if (processedBytes.length > 0) {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            new Uint8Array(processedBytes)
          );
          return (
            decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim() || "Unknown"
          );
        }
      }

      // Handle object format with data property
      if (
        typeof byteData === "object" &&
        "data" in byteData &&
        Array.isArray(byteData.data)
      ) {
        const processedBytes = byteData.data
          .map((item) =>
            typeof item === "number" ? item : parseInt(String(item), 10)
          )
          .filter((byte) => !isNaN(byte) && byte > 0);

        if (processedBytes.length > 0) {
          const decoded = new TextDecoder("utf-8", { fatal: false }).decode(
            new Uint8Array(processedBytes)
          );
          return (
            decoded.replace(/[\x00-\x1F\x7F-\x9F]/g, "").trim() || "Unknown"
          );
        }
      }

      // Handle plain string
      if (typeof byteData === "string" && !byteData.startsWith("0x")) {
        return byteData;
      }

      return "Unknown";
    } catch (conversionError) {
      console.error("Error converting bytes to string:", conversionError);
      return "Unknown";
    }
  };

  // Helper function to safely parse BigInt/string to number
  const safeParseBigInt = (
    value: string | number | undefined | null
  ): number | null => {
    try {
      if (value === null || value === undefined) return null;
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const parsed = parseInt(value, 10);
        return isNaN(parsed) ? null : parsed;
      }
      // Convert any other type to string safely
      const stringValue = String(value);
      const parsed = parseInt(stringValue, 10);
      return isNaN(parsed) ? null : parsed;
    } catch (parseError) {
      console.error("Error parsing BigInt:", parseError);
      return null;
    }
  };

  // Helper function to safely convert timestamp to date string
  const safeTimestampToDate = (timestamp: number): string => {
    try {
      const date =
        timestamp > 1e10 ? new Date(timestamp) : new Date(timestamp * 1000);
      return isNaN(date.getTime())
        ? "Invalid Date"
        : date.toISOString().split("T")[0];
    } catch (dateError) {
      console.error("Error converting timestamp to date:", dateError);
      return "Invalid Date";
    }
  };

  // Helper function to safely convert timestamp to ISO string
  const safeTimestampToISO = (timestamp: number | null): string | undefined => {
    try {
      if (!timestamp) return undefined;
      const date =
        timestamp > 1e10 ? new Date(timestamp) : new Date(timestamp * 1000);
      return isNaN(date.getTime()) ? undefined : date.toISOString();
    } catch (isoError) {
      console.error("Error converting timestamp to ISO:", isoError);
      return undefined;
    }
  };

  const getStatusConfig = (status: string): StatusConfig => {
    switch (status) {
      case "verified":
        return {
          icon: CheckCircle,
          color: "text-green-400",
          bgColor: "bg-green-500/20",
          borderColor: "border-green-500/30",
          title: "Product Verified",
          message: "This product is authentic and safe to use.",
          iconBg: "bg-green-500",
        };
      case "expired":
        return {
          icon: AlertTriangle,
          color: "text-yellow-400",
          bgColor: "bg-yellow-500/20",
          borderColor: "border-yellow-500/30",
          title: "Product Expired",
          message: "This product has passed its expiry date. Use with caution.",
          iconBg: "bg-yellow-500",
        };
      case "used":
        return {
          icon: XCircle,
          color: "text-orange-400",
          bgColor: "bg-orange-500/20",
          borderColor: "border-orange-500/30",
          title: "Product Already Used",
          message: "This product certificate has already been consumed.",
          iconBg: "bg-orange-500",
        };
      case "scan_expired":
        return {
          icon: Clock,
          color: "text-purple-400",
          bgColor: "bg-purple-500/20",
          borderColor: "border-purple-500/30",
          title: "Scan Window Expired",
          message: "The 24-hour verification window has expired.",
          iconBg: "bg-purple-500",
        };
      case "invalid":
        return {
          icon: XCircle,
          color: "text-red-400",
          bgColor: "bg-red-500/20",
          borderColor: "border-red-500/30",
          title: "Invalid Product",
          message:
            "This product could not be verified. Please contact the brand.",
          iconBg: "bg-red-500",
        };
      default:
        return {
          icon: Shield,
          color: "text-gray-400",
          bgColor: "bg-gray-500/20",
          borderColor: "border-gray-500/30",
          title: "Unknown Status",
          message: "Product status unknown.",
          iconBg: "bg-gray-500",
        };
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          className="text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-16 h-16 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Verifying Product
          </h2>
          <p className="text-white/70">
            Checking authenticity on the blockchain...
          </p>
        </motion.div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          className="text-center max-w-md p-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <XCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-2xl font-bold text-white mb-4">
            Verification Failed
          </h2>
          <p className="text-white/70 mb-6">
            {error || "Product not found or invalid QR code."}
          </p>
          <div className="flex flex-col sm:flex-row gap-3 justify-center">
            <button
              onClick={fetchAndVerifyProduct}
              disabled={loading}
              className="flex items-center justify-center space-x-2 px-6 py-3 gradient-purple-blue text-white rounded-xl font-medium hover:shadow-lg transition-all duration-300 disabled:opacity-50"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
              <span>Retry</span>
            </button>
            <Link
              href="/scan"
              className="px-6 py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all duration-300 text-center"
            >
              Scan Another Product
            </Link>
          </div>
        </motion.div>
      </div>
    );
  }

  const statusConfig = getStatusConfig(product.status);
  const StatusIcon = statusConfig.icon;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      {/* Header */}
      <div className="bg-slate-900/80 backdrop-blur-xl border-b border-white/10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link
                href="/scan"
                className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
              >
                <ArrowLeft size={20} />
                <span>Scan Another</span>
              </Link>
            </div>
            <div className="flex items-center space-x-3">
              {!isLoggedIn ? (
                <button
                  onClick={() => setShowAuthModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 gradient-purple-blue text-white rounded-lg hover:shadow-lg transition-all duration-300"
                >
                  <User size={16} />
                  <span>Login / Sign Up</span>
                </button>
              ) : (
                <>
                  <div className="flex items-center space-x-2 px-4 py-2 bg-white/10 text-white rounded-lg">
                    <Coins size={16} className="text-yellow-400" />
                    <span className="font-medium">{tokenCount}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    {userEmail && (
                      <span className="text-white/70 text-sm hidden sm:inline">
                        {userEmail}
                      </span>
                    )}
                    <button
                      onClick={handleLogout}
                      className="text-white/60 hover:text-white text-sm transition-colors"
                    >
                      Logout
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold gradient-text">
              Product Verification
            </h1>
            <p className="text-white/70 mt-1">
              Blockchain-verified authenticity check
            </p>
          </div>
        </div>
      </div>

      {/* Auth Modal */}
      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={handleAuthSuccess}
      />

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Status Header */}
        <motion.div
          className={`glass-card p-8 rounded-2xl text-center mb-8 border ${statusConfig.borderColor}`}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <div
            className={`w-20 h-20 ${statusConfig.iconBg} rounded-full flex items-center justify-center mx-auto mb-6`}
          >
            <StatusIcon className="w-10 h-10 text-white" />
          </div>

          <h2 className="text-3xl font-bold text-white mb-2">
            {statusConfig.title}
          </h2>
          <p className={`text-lg ${statusConfig.color} mb-4`}>
            {statusConfig.message}
          </p>

          <div
            className={`inline-flex items-center px-4 py-2 rounded-full ${statusConfig.bgColor} ${statusConfig.borderColor} border mb-4`}
          >
            <span className={`${statusConfig.color} font-medium`}>
              {product.status.charAt(0).toUpperCase() +
                product.status.slice(1).replace("_", " ")}
            </span>
          </div>

          {product.validationMessage && (
            <p className="text-white/60 text-sm">
              <strong>Blockchain Validation:</strong>{" "}
              {product.validationMessage}
            </p>
          )}
        </motion.div>

        {/* Token Claiming Section - ADD THIS */}
        {product.status === "verified" && (
          <TokenClaimingSection
            product={product}
            userTokens={tokenCount}
            onClaimTokens={(amount) => {
              // Update the local token count when tokens are claimed
              setTokenCount(prevCount => prevCount + amount);
              console.log(`User claimed ${amount} tokens`);
            }}
          />
        )}

        {/* Product Information */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Basic Info */}
          <motion.div
            className="glass-card p-8 rounded-2xl"
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
          >
            <h3 className="text-xl font-bold text-white mb-6">
              Product Details
            </h3>

            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <Package className="w-5 h-5 text-purple-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-sm">Product Name</p>
                  <p className="text-white font-semibold">
                    {product.productName}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Building className="w-5 h-5 text-blue-400 mt-1 flex-shrink-0" />
                <div className="flex items-center space-x-2">
                  <div>
                    <p className="text-white/70 text-sm">Brand</p>
                    <p className="text-white font-semibold">
                      {product.brandName}
                    </p>
                  </div>
                  {product.brandVerified && (
                    <div className="flex items-center space-x-1 bg-blue-500/20 px-2 py-1 rounded-full">
                      <CheckCircle className="w-3 h-3 text-blue-400" />
                      <span className="text-blue-400 text-xs">Verified</span>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <MapPin className="w-5 h-5 text-green-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-sm">Origin</p>
                  <p className="text-white font-semibold">{product.origin}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Hash className="w-5 h-5 text-yellow-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-sm">Batch Code</p>
                  <p className="text-white font-semibold font-mono">
                    {product.batchCode}
                  </p>
                </div>
              </div>
            </div>
          </motion.div>

          {/* Dates & Certification */}
          <motion.div
            className="glass-card p-8 rounded-2xl"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <h3 className="text-xl font-bold text-white mb-6">
              Certification Info
            </h3>

            <div className="space-y-6">
              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-orange-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-sm">Manufacturing Date</p>
                  <p className="text-white font-semibold">
                    {new Date(product.mintDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Calendar className="w-5 h-5 text-red-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-sm">Expiry Date</p>
                  <p className="text-white font-semibold">
                    {new Date(product.expiryDate).toLocaleDateString()}
                  </p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Shield className="w-5 h-5 text-cyan-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-sm">Certification Level</p>
                  <div className="flex items-center space-x-2">
                    <p className="text-white font-semibold">
                      {product.certificationLevel}
                    </p>
                    <span className="bg-cyan-500/20 text-cyan-400 px-2 py-1 rounded-full text-xs">
                      TraceChain Certified
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <Clock className="w-5 h-5 text-indigo-400 mt-1 flex-shrink-0" />
                <div>
                  <p className="text-white/70 text-sm">Verified On</p>
                  <p className="text-white font-semibold">
                    {new Date(product.verificationDate).toLocaleString()}
                  </p>
                </div>
              </div>

              {product.firstScannedAt && (
                <div className="flex items-start space-x-3">
                  <Scan className="w-5 h-5 text-pink-400 mt-1 flex-shrink-0" />
                  <div>
                    <p className="text-white/70 text-sm">First Scanned</p>
                    <p className="text-white font-semibold">
                      {new Date(product.firstScannedAt).toLocaleString()}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </div>

        {/* Blockchain Information */}
        <motion.div
          className="glass-card p-8 rounded-2xl mb-8"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
        >
          <h3 className="text-xl font-bold text-white mb-6">
            Blockchain Verification
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-white/70 text-sm mb-2">Brand Address</p>
              <p className="text-white font-mono text-sm break-all bg-white/5 p-3 rounded-lg">
                {product.brandAddress}
              </p>
            </div>

            <div>
              <p className="text-white/70 text-sm mb-2">Product ID</p>
              <p className="text-white font-mono text-sm break-all bg-white/5 p-3 rounded-lg">
                {product.id}
              </p>
            </div>
          </div>

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <p className="text-white/70 text-sm mb-2">Network</p>
              <div className="flex items-center space-x-3">
                <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                <span className="text-white font-semibold">
                  Aptos Blockchain
                </span>
                <span className="bg-green-500/20 text-green-400 px-2 py-1 rounded-full text-xs">
                  Devnet
                </span>
              </div>
            </div>

            <div>
              <p className="text-white/70 text-sm mb-2">Validation Status</p>
              <div className="flex items-center space-x-2">
                <span
                  className={`px-3 py-1 rounded-full text-xs ${
                    product.isValid
                      ? "bg-green-500/20 text-green-400"
                      : "bg-red-500/20 text-red-400"
                  }`}
                >
                  {product.isValid ? "Valid" : "Invalid"}
                </span>
                {product.used && (
                  <span className="bg-orange-500/20 text-orange-400 px-2 py-1 rounded-full text-xs">
                    Used
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="mt-6 p-4 bg-blue-500/10 border border-blue-500/20 rounded-xl">
            <div className="flex items-start space-x-3">
              <Shield className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="text-blue-400 font-semibold mb-1">
                  Blockchain Guarantee
                </h4>
                <p className="text-white/70 text-sm">
                  This product&apos;s authenticity is permanently recorded on
                  the Aptos blockchain. The verification cannot be tampered with
                  or falsified.
                </p>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
        >
          <Link
            href="/scan"
            className="px-8 py-3 gradient-purple-blue text-white rounded-xl font-medium hover:shadow-lg hover:scale-105 transition-all duration-300 text-center"
          >
            Verify Another Product
          </Link>
          <Link
            href="/"
            className="px-8 py-3 border border-white/20 text-white rounded-xl hover:bg-white/5 transition-all duration-300 text-center"
          >
            Back to Home
          </Link>
        </motion.div>
      </div>
    </div>
  );
};

export default VerifyProduct;
