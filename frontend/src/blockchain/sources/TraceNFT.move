module TraceChain::TraceNFT {
    use std::signer;
    use aptos_std::table;
    use std::option;
    use std::hash;
    use std::bcs;
    use std::vector;
    use aptos_framework::timestamp;
    use aptos_framework::transaction_context;
    use TraceChain::BrandRegistry;
    
    struct NFTInfo has copy, drop, store {
        product_name: vector<u8>,
        origin: vector<u8>,
        batch_code: vector<u8>,
        mint_date: u64,
        expiry_date: u64,  // Added expiry date field
        product_number: u64,
        used: bool,
        first_scanned_at: option::Option<u64>,
        nonce: u64,
    }
    
    struct BatchInfo has copy, drop, store {
        batch_code: vector<u8>,
        product_ids: vector<vector<u8>>,
        capacity: u64,
        current_count: u64,
        expiry_date: u64,  // Added batch-level expiry date
    }
    
    struct NFTMap has key {
        tokens: table::Table<vector<u8>, NFTInfo>,
        nonce_counter: u64,
        used_ids: table::Table<vector<u8>, bool>,
        nft_ids: vector<vector<u8>>,
        batch_codes: vector<vector<u8>>,
        batches: table::Table<vector<u8>, BatchInfo>,
    }
    
    const E_NOT_REGISTERED_BRAND: u64 = 2001;
    const E_NFTMAP_ALREADY_EXISTS: u64 = 2002;
    const E_NFTMAP_NOT_FOUND: u64 = 2003;
    const E_NFT_NOT_FOUND: u64 = 2004;
    const E_ID_COLLISION: u64 = 2005;
    const E_INVALID_PAGINATION: u64 = 2006;
    const E_BATCH_CAPACITY_EXCEEDED: u64 = 2007;
    const E_INVALID_BATCH_CAPACITY: u64 = 2008;
    const E_BATCH_NOT_FOUND: u64 = 2009;
    const E_INVALID_ID_LENGTH: u64 = 2010;
    const E_INVALID_EXPIRY_DATE: u64 = 2011;  // New error for invalid expiry
    const E_PRODUCT_EXPIRED: u64 = 2012;      // New error for expired products
    
    const CHARSET: vector<u8> = b"0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
    const CHARSET_LENGTH: u64 = 36;
    const ID_LENGTH: u64 = 8;
    
    public entry fun init_nftmap(account: &signer) {
        let account_addr = signer::address_of(account);
        assert!(!exists<NFTMap>(account_addr), E_NFTMAP_ALREADY_EXISTS);
        move_to(account, NFTMap {
            tokens: table::new<vector<u8>, NFTInfo>(),
            nonce_counter: 0,
            used_ids: table::new<vector<u8>, bool>(),
            nft_ids: vector::empty<vector<u8>>(),
            batch_codes: vector::empty<vector<u8>>(),
            batches: table::new<vector<u8>, BatchInfo>(),
        });
    }
    
    fun generate_secure_alphanumeric_id(
        brand_address: address,
        product_name: &vector<u8>,
        batch_code: &vector<u8>,
        mint_date: u64,
        nonce: u64
    ): vector<u8> {
        let entropy = vector::empty<u8>();
        
        vector::append(&mut entropy, bcs::to_bytes(&brand_address));
        vector::append(&mut entropy, *product_name);
        vector::append(&mut entropy, *batch_code);
        vector::append(&mut entropy, bcs::to_bytes(&mint_date));
        vector::append(&mut entropy, bcs::to_bytes(&timestamp::now_microseconds()));
        vector::append(&mut entropy, transaction_context::get_transaction_hash());
        vector::append(&mut entropy, bcs::to_bytes(&transaction_context::get_script_hash()));
        vector::append(&mut entropy, bcs::to_bytes(&nonce));
        
        let hash_bytes = hash::sha3_256(entropy);
        let id = vector::empty<u8>();
        
        let i = 0;
        while (i < ID_LENGTH) {
            let hash_index = i % vector::length(&hash_bytes);
            let hash_byte = *vector::borrow(&hash_bytes, hash_index);
            let char_index = (hash_byte as u64) % CHARSET_LENGTH;
            let char = *vector::borrow(&CHARSET, char_index);
            vector::push_back(&mut id, char);
            i = i + 1;
        };
        
        id
    }
    
    fun generate_batch_sequential_id(
        brand_address: address,
        batch_code: &vector<u8>,
        product_number: u64
    ): vector<u8> {
        let entropy = vector::empty<u8>();
        
        vector::append(&mut entropy, bcs::to_bytes(&brand_address));
        vector::append(&mut entropy, *batch_code);
        vector::append(&mut entropy, bcs::to_bytes(&product_number));
        
        let hash_bytes = hash::sha3_256(entropy);
        let id = vector::empty<u8>();
        
        let i = 0;
        while (i < ID_LENGTH) {
            let hash_index = i % vector::length(&hash_bytes);
            let hash_byte = *vector::borrow(&hash_bytes, hash_index);
            let char_index = (hash_byte as u64) % CHARSET_LENGTH;
            let char = *vector::borrow(&CHARSET, char_index);
            vector::push_back(&mut id, char);
            i = i + 1;
        };
        
        id
    }
    
    // Updated function to include expiry date
    public fun mint_batch_nfts(
        brand: &signer,
        registry_admin: address,
        product_name: vector<u8>,
        origin: vector<u8>,
        batch_code: vector<u8>,
        mint_date: u64,
        expiry_date: u64,  // New parameter for expiry date
        batch_capacity: u64
    ): vector<vector<u8>> acquires NFTMap {
        let brand_address = signer::address_of(brand);
        assert!(BrandRegistry::is_registered(registry_admin, brand_address), E_NOT_REGISTERED_BRAND);
        assert!(exists<NFTMap>(brand_address), E_NFTMAP_NOT_FOUND);
        assert!(batch_capacity > 0 && batch_capacity <= 999999, E_INVALID_BATCH_CAPACITY);
        assert!(expiry_date > mint_date, E_INVALID_EXPIRY_DATE);  // Ensure expiry is after mint date
        
        let store = borrow_global_mut<NFTMap>(brand_address);
        let generated_ids = vector::empty<vector<u8>>();
        
        if (!table::contains(&store.batches, batch_code)) {
            let batch_info = BatchInfo {
                batch_code: batch_code,
                product_ids: vector::empty<vector<u8>>(),
                capacity: batch_capacity,
                current_count: 0,
                expiry_date: expiry_date,  // Set batch expiry date
            };
            table::add(&mut store.batches, batch_code, batch_info);
            vector::push_back(&mut store.batch_codes, batch_code);
        };
        
        let batch_info = table::borrow_mut(&mut store.batches, batch_code);
        assert!(batch_info.current_count + batch_capacity <= batch_info.capacity, E_BATCH_CAPACITY_EXCEEDED);
        
        let i = 0;
        while (i < batch_capacity) {
            let product_number = batch_info.current_count + 1;
            
            let id = generate_batch_sequential_id(brand_address, &batch_code, product_number);
            
            let max_retries = 10;
            let retry_count = 0;
            
            while (table::contains(&store.tokens, id) && retry_count < max_retries) {
                store.nonce_counter = store.nonce_counter + 1;
                id = generate_secure_alphanumeric_id(
                    brand_address, 
                    &product_name, 
                    &batch_code, 
                    mint_date, 
                    store.nonce_counter
                );
                retry_count = retry_count + 1;
            };
            
            assert!(!table::contains(&store.tokens, id), E_ID_COLLISION);
            
            table::add(&mut store.tokens, id, NFTInfo {
                product_name: product_name,
                origin: origin,
                batch_code: batch_code,
                mint_date,
                expiry_date,  // Add expiry date to NFT info
                product_number,
                used: false,
                first_scanned_at: option::none(),
                nonce: store.nonce_counter,
            });
            
            table::add(&mut store.used_ids, id, true);
            vector::push_back(&mut store.nft_ids, id);
            vector::push_back(&mut generated_ids, id);
            vector::push_back(&mut batch_info.product_ids, id);
            
            store.nonce_counter = store.nonce_counter + 1;
            batch_info.current_count = batch_info.current_count + 1;
            i = i + 1;
        };
        
        generated_ids
    }
    
    // Updated entry function to include expiry date
    public entry fun mint_batch_nfts_entry(
        brand: &signer,
        registry_admin: address,
        product_name: vector<u8>,
        origin: vector<u8>,
        batch_code: vector<u8>,
        mint_date: u64,
        expiry_date: u64,  // New parameter
        batch_capacity: u64
    ) acquires NFTMap {
        mint_batch_nfts(
            brand,
            registry_admin,
            product_name,
            origin,
            batch_code,
            mint_date,
            expiry_date,  // Pass expiry date
            batch_capacity
        );
    }
    
    // New function to check if product is expired
    #[view]
    public fun is_expired(brand_addr: address, id: vector<u8>): bool acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return false
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (!table::contains(&store.tokens, id)) {
            return false
        };
        let nft = table::borrow(&store.tokens, id);
        let current_time = timestamp::now_seconds();
        current_time >= nft.expiry_date
    }
    
    // New function to get expiry date
    #[view]
    public fun get_expiry_date(brand_addr: address, id: vector<u8>): option::Option<u64> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return option::none<u64>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (!table::contains(&store.tokens, id)) {
            return option::none<u64>()
        };
        let nft = table::borrow(&store.tokens, id);
        option::some(nft.expiry_date)
    }
    
    // New function to get time remaining until expiry
    #[view]
    public fun get_time_until_expiry(brand_addr: address, id: vector<u8>): option::Option<u64> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return option::none<u64>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (!table::contains(&store.tokens, id)) {
            return option::none<u64>()
        };
        let nft = table::borrow(&store.tokens, id);
        let current_time = timestamp::now_seconds();
        
        if (current_time >= nft.expiry_date) {
            option::some(0)  // Already expired
        } else {
            option::some(nft.expiry_date - current_time)
        }
    }
    
    // New function to get all expired NFTs for a brand
    #[view]
    public fun get_expired_nfts(brand_addr: address): vector<vector<u8>> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return vector::empty<vector<u8>>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        let expired_ids = vector::empty<vector<u8>>();
        let current_time = timestamp::now_seconds();
        
        let i = 0;
        while (i < vector::length(&store.nft_ids)) {
            let id = *vector::borrow(&store.nft_ids, i);
            let nft = table::borrow(&store.tokens, id);
            if (current_time >= nft.expiry_date) {
                vector::push_back(&mut expired_ids, id);
            };
            i = i + 1;
        };
        
        expired_ids
    }
    
    // New function to get NFTs expiring within a certain timeframe
    #[view]
    public fun get_nfts_expiring_soon(brand_addr: address, seconds_ahead: u64): vector<vector<u8>> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return vector::empty<vector<u8>>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        let expiring_ids = vector::empty<vector<u8>>();
        let current_time = timestamp::now_seconds();
        let threshold_time = current_time + seconds_ahead;
        
        let i = 0;
        while (i < vector::length(&store.nft_ids)) {
            let id = *vector::borrow(&store.nft_ids, i);
            let nft = table::borrow(&store.tokens, id);
            if (nft.expiry_date <= threshold_time && nft.expiry_date > current_time) {
                vector::push_back(&mut expiring_ids, id);
            };
            i = i + 1;
        };
        
        expiring_ids
    }
    
    // Updated mark_used function to check for expiry
    public fun mark_used(brand: &signer, id: vector<u8>) acquires NFTMap {
        let brand_addr = signer::address_of(brand);
        assert!(exists<NFTMap>(brand_addr), E_NFTMAP_NOT_FOUND);
        
        let store = borrow_global_mut<NFTMap>(brand_addr);
        assert!(table::contains(&store.tokens, id), E_NFT_NOT_FOUND);
        
        let nft = table::borrow_mut(&mut store.tokens, id);
        let current_time = timestamp::now_seconds();
        assert!(current_time < nft.expiry_date, E_PRODUCT_EXPIRED);  // Check if product is expired
        
        nft.used = true;
    }
    
    // Rest of the existing functions remain the same...
    #[view]
    public fun get_all_batch_codes(brand_addr: address): vector<vector<u8>> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return vector::empty<vector<u8>>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        store.batch_codes
    }
    
    #[view]
    public fun get_batch_products(brand_addr: address, batch_code: vector<u8>): vector<vector<u8>> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return vector::empty<vector<u8>>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (!table::contains(&store.batches, batch_code)) {
            return vector::empty<vector<u8>>()
        };
        let batch_info = table::borrow(&store.batches, batch_code);
        batch_info.product_ids
    }
    
    #[view]
    public fun get_nft(brand_addr: address, id: vector<u8>): option::Option<NFTInfo> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return option::none<NFTInfo>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (table::contains(&store.tokens, id)) {
            option::some(*table::borrow(&store.tokens, id))
        } else {
            option::none<NFTInfo>()
        }
    }
    
    #[view]
    public fun get_all_nft_ids(brand_addr: address): vector<vector<u8>> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return vector::empty<vector<u8>>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        store.nft_ids
    }
    
    #[view]
    public fun get_nft_ids_paginated(
        brand_addr: address, 
        offset: u64, 
        limit: u64
    ): vector<vector<u8>> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return vector::empty<vector<u8>>()
        };
        
        let store = borrow_global<NFTMap>(brand_addr);
        let total_ids = vector::length(&store.nft_ids);
        
        if (offset >= total_ids) {
            return vector::empty<vector<u8>>()
        };
        
        let end = if (offset + limit > total_ids) { total_ids } else { offset + limit };
        let result = vector::empty<vector<u8>>();
        
        let i = offset;
        while (i < end) {
            vector::push_back(&mut result, *vector::borrow(&store.nft_ids, i));
            i = i + 1;
        };
        
        result
    }
    
    #[view]
    public fun get_nfts_batch(brand_addr: address, ids: vector<vector<u8>>): vector<option::Option<NFTInfo>> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            let empty_results = vector::empty<option::Option<NFTInfo>>();
            let i = 0;
            while (i < vector::length(&ids)) {
                vector::push_back(&mut empty_results, option::none<NFTInfo>());
                i = i + 1;
            };
            return empty_results
        };
        
        let store = borrow_global<NFTMap>(brand_addr);
        let results = vector::empty<option::Option<NFTInfo>>();
        
        let i = 0;
        while (i < vector::length(&ids)) {
            let id = *vector::borrow(&ids, i);
            if (table::contains(&store.tokens, id)) {
                vector::push_back(&mut results, option::some(*table::borrow(&store.tokens, id)));
            } else {
                vector::push_back(&mut results, option::none<NFTInfo>());
            };
            i = i + 1;
        };
        
        results
    }
    
    #[view]
    public fun get_nfts_paginated(
        brand_addr: address, 
        offset: u64, 
        limit: u64
    ): (vector<vector<u8>>, vector<NFTInfo>) acquires NFTMap {
        let ids = get_nft_ids_paginated(brand_addr, offset, limit);
        let nfts = vector::empty<NFTInfo>();
        
        if (!exists<NFTMap>(brand_addr)) {
            return (ids, nfts)
        };
        
        let store = borrow_global<NFTMap>(brand_addr);
        let i = 0;
        while (i < vector::length(&ids)) {
            let id = *vector::borrow(&ids, i);
            if (table::contains(&store.tokens, id)) {
                vector::push_back(&mut nfts, *table::borrow(&store.tokens, id));
            };
            i = i + 1;
        };
        
        (ids, nfts)
    }
    
    #[view]
    public fun is_used(brand_addr: address, id: vector<u8>): bool acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return false
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (!table::contains(&store.tokens, id)) {
            return false
        };
        let nft = table::borrow(&store.tokens, id);
        nft.used
    }
    
    #[view]
    public fun get_first_scanned_at(brand_addr: address, id: vector<u8>): option::Option<u64> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return option::none<u64>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (!table::contains(&store.tokens, id)) {
            return option::none<u64>()
        };
        let nft = table::borrow(&store.tokens, id);
        nft.first_scanned_at
    }
    
    public fun set_first_scanned_at(brand: &signer, id: vector<u8>, value: u64) acquires NFTMap {
        let brand_addr = signer::address_of(brand);
        assert!(exists<NFTMap>(brand_addr), E_NFTMAP_NOT_FOUND);
        
        let store = borrow_global_mut<NFTMap>(brand_addr);
        assert!(table::contains(&store.tokens, id), E_NFT_NOT_FOUND);
        
        let nft = table::borrow_mut(&mut store.tokens, id);
        nft.first_scanned_at = option::some(value);
    }
    
    #[view]
    public fun validate_id_format(id: vector<u8>): bool {
        if (vector::length(&id) != ID_LENGTH) {
            return false
        };
        
        let i = 0;
        while (i < vector::length(&id)) {
            let char = *vector::borrow(&id, i);
            let valid = false;
            
            let j = 0;
            while (j < vector::length(&CHARSET)) {
                if (char == *vector::borrow(&CHARSET, j)) {
                    valid = true;
                    break
                };
                j = j + 1;
            };
            
            if (!valid) {
                return false
            };
            i = i + 1;
        };
        
        true
    }
    
    #[view]
    public fun get_nft_count(brand_addr: address): u64 acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return 0
        };
        let store = borrow_global<NFTMap>(brand_addr);
        vector::length(&store.nft_ids)
    }
    
    #[view]
    public fun get_batch_info(brand_addr: address, batch_code: vector<u8>): option::Option<BatchInfo> acquires NFTMap {
        if (!exists<NFTMap>(brand_addr)) {
            return option::none<BatchInfo>()
        };
        let store = borrow_global<NFTMap>(brand_addr);
        if (!table::contains(&store.batches, batch_code)) {
            return option::none<BatchInfo>()
        };
        option::some(*table::borrow(&store.batches, batch_code))
    }
    
    #[view]
    public fun get_id_charset(): vector<u8> {
        CHARSET
    }
    
    #[view]
    public fun get_id_length(): u64 {
        ID_LENGTH
    }
    
    #[view]
    public fun get_max_possible_ids(): u64 {
        let result = 1u64;
        let i = 0;
        while (i < ID_LENGTH) {
            result = result * CHARSET_LENGTH;
            i = i + 1;
        };
        result
    }
    
    #[view]
    public fun id_to_string(id: vector<u8>): vector<u8> {
        id
    }
    
    #[view]
    public fun verify_nft_integrity(brand_addr: address, id: vector<u8>): bool acquires NFTMap {
        let nft_option = get_nft(brand_addr, id);
        if (option::is_none(&nft_option)) {
            return false
        };
        
        let nft = option::extract(&mut nft_option);
        
        let expected_id = generate_batch_sequential_id(
            brand_addr,
            &nft.batch_code,
            nft.product_number
        );
        
        if (expected_id == id) {
            return true
        };
        
        let expected_id_random = generate_secure_alphanumeric_id(
            brand_addr,
            &nft.product_name,
            &nft.batch_code,
            nft.mint_date,
            nft.nonce
        );
        
        expected_id_random == id
    }
}