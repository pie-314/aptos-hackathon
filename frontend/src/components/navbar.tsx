"use client";

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import React from 'react';

// Define the navigation items in one place for consistency
const navItems = ['About', 'For Brands', 'For Consumers'];

const Navbar: React.FC = () => {
    const [isMenuOpen, setIsMenuOpen] = useState<boolean>(false);
    const mobileMenuRef = useRef<HTMLDivElement>(null);

    // Function to close the menu
    const closeMenu = useCallback(() => {
        setIsMenuOpen(false);
    }, []);

    // Effect to handle clicks outside the mobile menu
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent | TouchEvent) => {
            const menuButton = (event.target as HTMLElement).closest('button[aria-label="Toggle menu"]');
            if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target as Node) && !menuButton) {
                closeMenu();
            }
        };

        if (isMenuOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            document.addEventListener('touchstart', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
            document.removeEventListener('touchstart', handleClickOutside);
        };
    }, [isMenuOpen, closeMenu]);

    // Effect for mobile menu slide animation
    useEffect(() => {
        const menu = mobileMenuRef.current;
        if (!menu) return;

        if (isMenuOpen) {
            menu.style.display = 'block';
            // Delay setting max-height to allow for display property to apply
            requestAnimationFrame(() => {
                menu.style.maxHeight = `${menu.scrollHeight}px`;
            });
        } else {
            menu.style.maxHeight = "0";
            const handleTransitionEnd = () => {
                if (menu.style.maxHeight === "0px") {
                    menu.style.display = 'none';
                }
                menu.removeEventListener('transitionend', handleTransitionEnd);
            };
            menu.addEventListener('transitionend', handleTransitionEnd);
        }
    }, [isMenuOpen]);

    // Effect to prevent body scroll when menu is open
    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }

        return () => {
            document.body.style.overflow = ''; // Cleanup on component unmount
        };
    }, [isMenuOpen]);

    return (
        <nav className="fixed top-0 z-[100] bg-slate-900/80 backdrop-blur-xl border border-white/10 px-4 py-2 w-[90%] lg:w-[65%] xl:w-[55%] 2xl:w-[45%] mx-auto rounded-2xl left-0 right-0 mt-5 shadow-xl">
            <div className="max-w-7xl mx-auto flex items-center justify-between h-full">
                {/* Brand Logo/Name */}
                <Link href="/" className="flex items-center space-x-3" onClick={closeMenu}>
                    <span className="text-white text-2xl font-extrabold tracking-tight gradient-text">TraceChain</span>
                </Link>

                 <div className="flex-1"></div>

                {/* Desktop Navigation */}
                <div className="hidden xl:flex space-x-2 text-white/90 font-medium">
                    {navItems.map((item) => (
                        <Link
                            key={item}
                            href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                            className="relative px-4 py-2 transition-all duration-300 ease-in-out rounded-lg hover:text-white group"
                        >
                            <span className="relative z-10">{item}</span>
                            <span className="absolute inset-0 bg-white/10 rounded-lg opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-in-out"></span>
                        </Link>
                    ))}
                </div>

                {/* Mobile Menu Button */}
                <button
                    className="xl:hidden text-white focus:outline-none touch-manipulation"
                    onClick={() => setIsMenuOpen(!isMenuOpen)}
                    aria-label="Toggle menu"
                    aria-expanded={isMenuOpen}
                >
                    {isMenuOpen ? (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    ) : (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16m-7 6h7" />
                        </svg>
                    )}
                </button>
            </div>

            {/* Mobile Navigation Menu */}
            <div
                ref={mobileMenuRef}
                className="xl:hidden overflow-hidden transition-[max-height] duration-500 ease-out bg-transparent p-4"
                style={{ maxHeight: 0, display: 'none' }}
                aria-hidden={!isMenuOpen}
            >
                {navItems.map((item, index) => (
                    <Link
                        key={item}
                        href={`#${item.toLowerCase().replace(/\s+/g, '-')}`}
                        className="block text-white/90 py-3 hover:text-white hover:bg-white/5 rounded-lg px-2 transition-all duration-200"
                        onClick={closeMenu}
                        style={{ transitionDelay: `${index * 50}ms` }}
                    >
                        {item}
                    </Link>
                ))}
            </div>
        </nav>
    );
};

export default Navbar;