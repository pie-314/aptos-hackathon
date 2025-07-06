"use client";

import { useState } from 'react';
import { motion } from 'framer-motion';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Building, Mail, Phone, MapPin, Tag, User, CheckCircle, AlertCircle, Briefcase } from 'lucide-react';
import Link from 'next/link';
import { supabase, type Brand } from '@/lib/supabase';

interface BrandFormData {
  brandName: string;
  brandEmail: string;
  contactNumber: string;
  brandAddress: string;
  brandType: string;
  registrarName: string;
}


const BrandRegistration = () => {
  const router = useRouter();
  const [formData, setFormData] = useState<BrandFormData>({
    brandName: '',
    brandEmail: '',
    contactNumber: '',
    brandAddress: '',
    brandType: '',
    registrarName: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<BrandFormData>>({});
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitError, setSubmitError] = useState<string>('');

  const handleInputChange = (field: keyof BrandFormData, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
    // Clear submit error
    if (submitError) {
      setSubmitError('');
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Partial<BrandFormData> = {};

    if (!formData.brandName.trim()) {
      newErrors.brandName = 'Brand name is required';
    }

    if (!formData.brandEmail.trim()) {
      newErrors.brandEmail = 'Brand email is required';
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.brandEmail)) {
      newErrors.brandEmail = 'Please enter a valid email address';
    }

    if (!formData.contactNumber.trim()) {
      newErrors.contactNumber = 'Contact number is required';
    } else if (!/^\+?[\d\s-()]{10,}$/.test(formData.contactNumber)) {
      newErrors.contactNumber = 'Please enter a valid contact number';
    }

    if (!formData.brandAddress.trim()) {
      newErrors.brandAddress = 'Brand address is required';
    }

    if (!formData.registrarName.trim()) {
      newErrors.registrarName = 'Registering person name is required';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setIsSubmitting(true);
    setSubmitError('');

    try {
      // Check if brand email already exists
      const { data: existingBrand, error: checkError } = await supabase
        .from('Brand')
        .select('brandEmail')
        .eq('brandEmail', formData.brandEmail)
        .single();

      if (checkError && checkError.code !== 'PGRST116') {
        throw new Error('Failed to check existing brand');
      }

      if (existingBrand) {
        setSubmitError('A brand with this email already exists');
        setIsSubmitting(false);
        return;
      }

      // Insert new brand data
      const brandData: Omit<Brand, 'id' | 'created_at'> = {
        brandName: formData.brandName.trim(),
        brandEmail: formData.brandEmail.trim().toLowerCase(),
        contactNumber: formData.contactNumber.trim(),
        brandAddress: formData.brandAddress.trim(),
        registrarName: formData.registrarName.trim()
      };

      const { data, error } = await supabase
        .from('Brand')
        .insert([brandData])
        .select()
        .single();

      if (error) {
        console.error('Supabase error:', error);
        throw new Error(error.message || 'Failed to register brand');
      }

      console.log('Brand registered successfully:', data);
      setSubmitSuccess(true);
      
      // Redirect to success page or dashboard after 2 seconds
      setTimeout(() => {
        router.push('/dashboard');
      }, 2000);
    } catch (error) {
      console.error('Registration failed:', error);
      setSubmitError(
        error instanceof Error 
          ? error.message 
          : 'Registration failed. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitSuccess) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
        <motion.div
          className="text-center p-8"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6 }}
        >
          <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-6">
            <CheckCircle className="w-10 h-10 text-white" />
          </div>
          <h2 className="text-3xl font-bold text-white mb-4">Registration Successful!</h2>
          <p className="text-white/70 mb-6">
            Welcome to TraceChain! Your brand has been successfully registered.
            <br />
            Redirecting to your dashboard...
          </p>
          <div className="w-8 h-8 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
        </motion.div>
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
              href="/"
              className="flex items-center space-x-2 text-white/70 hover:text-white transition-colors"
            >
              <ArrowLeft size={20} />
              <span>Back to Home</span>
            </Link>
          </div>
          <div className="mt-4">
            <h1 className="text-3xl font-bold gradient-text">Brand Registration</h1>
            <p className="text-white/70 mt-1">Join TraceChain and start protecting your products with blockchain technology</p>
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
          <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 mb-8">
            <div className="flex items-start space-x-3">
              <AlertCircle className="w-5 h-5 text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="text-blue-400 font-semibold mb-1">Why Register with TraceChain?</h3>
                <p className="text-white/70 text-sm">
                  • Protect your brand from counterfeiting with blockchain-secured certificates
                  <br />
                  • Generate unique QR codes for each product batch
                  <br />
                  • Build customer trust with transparent product verification
                  <br />
                  • Access detailed analytics and tracking dashboard
                </p>
              </div>
            </div>
          </div>

          {/* Display submit error if any */}
          {submitError && (
            <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6">
              <div className="flex items-center space-x-3">
                <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
                <p className="text-red-400">{submitError}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-8">
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <Building size={18} />
                <span>Brand Name</span>
              </label>
              <input
                type="text"
                value={formData.brandName}
                onChange={(e) => handleInputChange('brandName', e.target.value)}
                placeholder="Enter your brand name"
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                  errors.brandName 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
              />
              {errors.brandName && (
                <p className="text-red-400 text-sm mt-1">{errors.brandName}</p>
              )}
            </div>

            
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <Mail size={18} />
                <span>Brand Email</span>
              </label>
              <input
                type="email"
                value={formData.brandEmail}
                onChange={(e) => handleInputChange('brandEmail', e.target.value)}
                placeholder="Enter your brand email address"
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                  errors.brandEmail 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
              />
              {errors.brandEmail && (
                <p className="text-red-400 text-sm mt-1">{errors.brandEmail}</p>
              )}
            </div>

            {/* Contact Number */}
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <Phone size={18} />
                <span>Contact Number</span>
              </label>
              <input
                type="tel"
                value={formData.contactNumber}
                onChange={(e) => handleInputChange('contactNumber', e.target.value)}
                placeholder="Enter your contact number"
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                  errors.contactNumber 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
              />
              {errors.contactNumber && (
                <p className="text-red-400 text-sm mt-1">{errors.contactNumber}</p>
              )}
            </div>

            {/* Brand Address */}
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <MapPin size={18} />
                <span>Brand Address</span>
              </label>
              <textarea
                value={formData.brandAddress}
                onChange={(e) => handleInputChange('brandAddress', e.target.value)}
                placeholder="Enter your complete brand address"
                rows={3}
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all resize-none ${
                  errors.brandAddress 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
              />
              {errors.brandAddress && (
                <p className="text-red-400 text-sm mt-1">{errors.brandAddress}</p>
              )}
            </div>

            {/* Brand Type */}
            {/* <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <Tag size={18} />
                <span>Brand Type</span>
              </label>
              <select
                value={formData.brandType}
                onChange={(e) => handleInputChange('brandType', e.target.value)}
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white focus:outline-none focus:ring-2 transition-all appearance-none cursor-pointer ${
                  errors.brandType 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
              >
                <option value="">Select your brand type</option>
                {brandTypes.map((type) => (
                  <option key={type} value={type} className="bg-slate-800 text-white">
                    {type}
                  </option>
                ))}
              </select>
              {errors.brandType && (
                <p className="text-red-400 text-sm mt-1">{errors.brandType}</p>
              )}
            </div> */}

            {/* Registering Person Name */}
            <div>
              <label className="flex items-center space-x-2 text-white font-medium mb-3">
                <User size={18} />
                <span>Registering Person Name</span>
              </label>
              <input
                type="text"
                value={formData.registrarName}
                onChange={(e) => handleInputChange('registrarName', e.target.value)}
                placeholder="Enter the name of person registering"
                className={`w-full px-4 py-3 bg-white/5 border rounded-xl text-white placeholder-white/50 focus:outline-none focus:ring-2 transition-all ${
                  errors.registrarName 
                    ? 'border-red-500 focus:ring-red-500' 
                    : 'border-white/10 focus:ring-purple-500'
                }`}
              />
              {errors.registrarName && (
                <p className="text-red-400 text-sm mt-1">{errors.registrarName}</p>
              )}
            </div>

            {/* Terms and Conditions */}
            <div className="bg-white/5 p-4 rounded-xl">
              <h3 className="text-white font-semibold mb-2">Terms & Conditions</h3>
              <p className="text-white/70 text-sm mb-3">
                By registering with TraceChain, you agree to our terms of service and privacy policy. 
                Your brand information will be securely stored and used only for verification purposes.
              </p>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="terms"
                  required
                  className="w-4 h-4 text-purple-600 bg-white/10 border-white/20 rounded focus:ring-purple-500"
                />
                <label htmlFor="terms" className="text-white/90 text-sm">
                  I agree to the{' '}
                  <Link href="/terms" className="text-purple-400 hover:text-purple-300 transition-colors">
                    Terms of Service
                  </Link>{' '}
                  and{' '}
                  <Link href="/privacy" className="text-purple-400 hover:text-purple-300 transition-colors">
                    Privacy Policy
                  </Link>
                </label>
              </div>
            </div>

            {/* Submit Button */}
            <div className="flex justify-end space-x-4 pt-6">
              <Link
                href="/"
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
                    <span>Registering Brand...</span>
                  </>
                ) : (
                  <>
                    <Briefcase size={20} />
                    <span>Register Brand</span>
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

export default BrandRegistration;
