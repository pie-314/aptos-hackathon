module TraceChain::BrandRegistry {
    use std::signer;
    use aptos_std::table;
    use std::option;
    use std::vector;
    use std::string::{Self, String};
    
    struct BrandInfo has copy, drop, store {
        name: vector<u8>,
        registered_at: u64,
    }
    
    struct Registry has key {
        brands: table::Table<address, BrandInfo>,
        name_to_address: table::Table<String, address>,  // New reverse lookup table
        admin: address,
    }
    
    const E_NOT_ADMIN: u64 = 1001;
    const E_REGISTRY_ALREADY_EXISTS: u64 = 1002;
    const E_BRAND_ALREADY_REGISTERED: u64 = 1003;
    const E_REGISTRY_NOT_FOUND: u64 = 1004;
    
    public entry fun init_registry(admin: &signer) {
        let admin_addr = signer::address_of(admin);
        assert!(!exists<Registry>(admin_addr), E_REGISTRY_ALREADY_EXISTS);
        move_to(admin, Registry {
            brands: table::new<address, BrandInfo>(),
            name_to_address: table::new<String, address>(),
            admin: admin_addr,
        });
    }
    
    public entry fun register_brand(admin: &signer, brand: address, name: vector<u8>, timestamp: u64) acquires Registry {
        let admin_addr = signer::address_of(admin);
        assert!(exists<Registry>(admin_addr), E_REGISTRY_NOT_FOUND);
        let registry = borrow_global_mut<Registry>(admin_addr);
        assert!(admin_addr == registry.admin, E_NOT_ADMIN);
        assert!(!table::contains(&registry.brands, brand), E_BRAND_ALREADY_REGISTERED);
        
        let brand_name_string = string::utf8(name);
        
        // Add to both tables
        table::add(&mut registry.brands, brand, BrandInfo {
            name,
            registered_at: timestamp,
        });
        table::add(&mut registry.name_to_address, brand_name_string, brand);
    }
    
    #[view]
    public fun is_registered(admin_addr: address, brand: address): bool acquires Registry {
        if (!exists<Registry>(admin_addr)) {
            return false
        };
        let registry = borrow_global<Registry>(admin_addr);
        table::contains(&registry.brands, brand)
    }
    
    #[view]
    public fun get_brand_info(admin_addr: address, brand: address): option::Option<BrandInfo> acquires Registry {
        if (!exists<Registry>(admin_addr)) {
            return option::none<BrandInfo>()
        };
        let registry = borrow_global<Registry>(admin_addr);
        if (table::contains(&registry.brands, brand)) {
            option::some(*table::borrow(&registry.brands, brand))
        } else {
            option::none<BrandInfo>()
        }
    }
    
    #[view]
    public fun get_brand_name(admin_addr: address, brand: address): option::Option<vector<u8>> acquires Registry {
        if (!exists<Registry>(admin_addr)) {
            return option::none<vector<u8>>()
        };
        let registry = borrow_global<Registry>(admin_addr);
        if (table::contains(&registry.brands, brand)) {
            let brand_info = table::borrow(&registry.brands, brand);
            option::some(brand_info.name)
        } else {
            option::none<vector<u8>>()
        }
    }
    
    #[view]
    public fun get_brand_address(admin_addr: address, brand_name: vector<u8>): option::Option<address> acquires Registry {
        if (!exists<Registry>(admin_addr)) {
            return option::none<address>()
        };
        let registry = borrow_global<Registry>(admin_addr);
        let brand_name_string = string::utf8(brand_name);
        
        if (table::contains(&registry.name_to_address, brand_name_string)) {
            option::some(*table::borrow(&registry.name_to_address, brand_name_string))
        } else {
            option::none<address>()
        }
    }
}
