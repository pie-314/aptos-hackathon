module TraceChain::VerifyNFT {
    use std::option;
    use std::signer;
    use std::bcs;
    use TraceChain::TraceNFT;
    use TraceChain::BrandRegistry;
    
    const SECONDS_IN_24_HOURS: u64 = 86400;
    
    const E_NFT_EXPIRED: u64 = 3001;
    const E_NFT_USED: u64 = 3002;
    const E_NOT_BRAND_OWNER: u64 = 3003;
    
    // Helper function to convert u64 to vector<u8>
    fun u64_to_bytes(value: u64): vector<u8> {
        bcs::to_bytes(&value)
    }
    
    // Helper function to check if NFT is expired (since TraceNFT::is_expired doesn't exist)
    fun is_nft_expired(brand_addr: address, id: u64, current_time: u64): bool {
        let id_bytes = u64_to_bytes(id);
        let nft_option = TraceNFT::get_nft(brand_addr, id_bytes);
        
        if (option::is_none(&nft_option)) {
            return false // NFT doesn't exist, so not expired
        };
        
        // You'll need to implement expiration logic based on your NFT structure
        // For now, assuming NFTs don't expire unless explicitly marked
        false
    }
    
    public fun scan_nft(brand: &signer, id: u64, current_time: u64): bool {
        let brand_addr = signer::address_of(brand);
        let id_bytes = u64_to_bytes(id);
        
        if (TraceNFT::is_used(brand_addr, id_bytes) || is_nft_expired(brand_addr, id, current_time)) {
            return false
        };
        
        let first_scanned = TraceNFT::get_first_scanned_at(brand_addr, id_bytes);
        
        if (option::is_none(&first_scanned)) {
            TraceNFT::set_first_scanned_at(brand, id_bytes, current_time);
            true
        } else {
            let first = *option::borrow(&first_scanned);
            let elapsed = current_time - first;
            elapsed <= SECONDS_IN_24_HOURS
        }
    }
    
    #[view]
    public fun is_valid(brand_addr: address, id: u64, current_time: u64): bool {
        let id_bytes = u64_to_bytes(id);
        
        if (TraceNFT::is_used(brand_addr, id_bytes) || is_nft_expired(brand_addr, id, current_time)) {
            return false
        };
        
        let first_scanned = TraceNFT::get_first_scanned_at(brand_addr, id_bytes);
        
        if (option::is_none(&first_scanned)) {
            true
        } else {
            let first = *option::borrow(&first_scanned);
            let elapsed = current_time - first;
            elapsed <= SECONDS_IN_24_HOURS
        }
    }
    
    #[view]
    public fun verify_authenticity(
        brand_addr: address, 
        id: u64, 
        current_time: u64
    ): (bool, vector<u8>) {
        let id_bytes = u64_to_bytes(id);
        
        if (TraceNFT::is_used(brand_addr, id_bytes)) {
            return (false, b"NFT already used")
        };
        
        if (is_nft_expired(brand_addr, id, current_time)) {
            return (false, b"NFT expired")
        };
        
        let nft_option = TraceNFT::get_nft(brand_addr, id_bytes);
        if (option::is_none(&nft_option)) {
            return (false, b"NFT not found")
        };
        
        let first_scanned = TraceNFT::get_first_scanned_at(brand_addr, id_bytes);
        
        if (option::is_none(&first_scanned)) {
            (true, b"Valid - First scan")
        } else {
            let first = *option::borrow(&first_scanned);
            let elapsed = current_time - first;
            if (elapsed <= SECONDS_IN_24_HOURS) {
                (true, b"Valid - Within 24 hours")
            } else {
                (false, b"Scan window expired")
            }
        }
    }
    
    #[view]
    public fun get_brand_name(registry_admin: address, brand_addr: address): option::Option<vector<u8>> {
        BrandRegistry::get_brand_name(registry_admin, brand_addr)
    }
    
    public fun consume_nft(brand: &signer, id: u64, current_time: u64): bool {
        let brand_addr = signer::address_of(brand);
        let id_bytes = u64_to_bytes(id);
        
        if (!is_valid(brand_addr, id, current_time)) {
            return false
        };
        
        TraceNFT::mark_used(brand, id_bytes);
        true
    }
}
