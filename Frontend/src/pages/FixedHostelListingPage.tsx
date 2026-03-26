import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { accommodationsApi } from '../services/api';

// Fallback image as data URI to avoid network requests
const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"%3E%3Crect width="600" height="400" fill="%23e2e8f0"%3E%3C/rect%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="%2364748b"%3EImage Unavailable%3C/text%3E%3C/svg%3E';

// Define interfaces for type safety
interface Accommodation {
  _id?: string;
  id?: string;
  name: string;
  description?: string;
  price?: number;
  startingFrom?: string;
  uniqueCode?: string; // Added uniqueCode field

  rating?: number;
  reviews?: Array<{
    userId: string;
    rating: number;
    comment: string;
    date: Date;
  }>;
  amenities?: string[];
  features?: string[]; // Added features array for amenities/food preferences from admin panel
  images?: string[];
  type?: string;
  gender?: string; // For backward compatibility
  availableFor?: string; // Backend field
  
  // Food type fields
  foodType?: string; // 'veg', 'non-veg', or undefined
  messAvailable?: boolean;
  vegOnly?: boolean;
  
  // Food object from backend model
  food?: {
    available?: boolean;
    vegOnly?: boolean;
    mealTypes?: string[];
  };

  verified?: boolean;
}

// Helper: compute average rating for an accommodation
const getAverageRating = (accom: Accommodation): number | null => {
  if (!accom.reviews || accom.reviews.length === 0) return null;
  const total = accom.reviews.reduce((sum, r) => sum + (r.rating || 0), 0);
  return +(total / accom.reviews.length).toFixed(1);
};

// Filter options interface - removed as currently unused
// interface FilterOptions {
//   priceRange?: [number, number];
//   college?: string;
//   messType?: string;
//   maxDistanceToCollege?: number;
//   maxDistanceToMetro?: number;
//   amenities?: string[];
//   city?: string;
//   type?: string;
//   gender?: string;
// }

// Props for HostelCard component
interface HostelCardProps {
  accommodation: Accommodation;
}

// HostelCard component - memoized for performance
const HostelCard = React.memo(({ accommodation }: HostelCardProps) => {
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isHovered, setIsHovered] = useState(false);

  // Reset image index when mouse leaves
  useEffect(() => {
    if (!isHovered) {
      setCurrentImageIndex(0);
    }
  }, [isHovered]);

  useEffect(() => {
    if (!accommodation.images || accommodation.images.length <= 1 || !isHovered) return;

    const interval = setInterval(() => {
      setCurrentImageIndex(prevIndex => (prevIndex + 1) % accommodation.images!.length);
    }, 3000);

    return () => clearInterval(interval);
  }, [accommodation.images, isHovered]);

  // Function to get image URL with fallback
  const getImageUrl = (accommodation: Accommodation) => {
    if (accommodation.images?.[0]) {
      return accommodation.images[0];
    }
    return FALLBACK_IMAGE;
  };

  // Format price with startingFrom field
  const formatPrice = (accommodation: Accommodation) => {
    if (accommodation.startingFrom) {
      return `Starting from ${accommodation.startingFrom}`;
    } else if (accommodation.price) {
      return `Starting from ₹${accommodation.price.toLocaleString('en-IN')}`;
    } else {
      return 'Starting from ₹0';
    }
  };

  return (
    <div 
      className="bg-[#fff9ed] rounded-2xl shadow-sm overflow-hidden cursor-pointer transition-all duration-300 ease-in-out relative transform hover:scale-[1.02] hover:shadow-md border border-neutral-100"
      style={{
        zIndex: isHovered ? 10 : 1
      }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      onClick={() => navigate(`/accommodation/${accommodation._id || accommodation.id}`)}
    >
      {/* Image Carousel */}
      <div className="relative h-56 overflow-hidden">
        {accommodation.images && accommodation.images.length > 0 ? (
          <>
            <div className="absolute inset-0 flex transition-transform duration-500 ease-in-out" style={{
              transform: `translateX(-${currentImageIndex * 100}%)`
            }}>
              {accommodation.images.map((imageUrl, index) => (
                <img 
                  key={index}
                  className="flex-shrink-0 w-full h-full object-cover" 
                  src={imageUrl} 
                  alt={`${accommodation.name} ${index+1}`} 
                  loading="lazy" 
                  onError={(e) => {
                    e.currentTarget.src = FALLBACK_IMAGE;
                  }}
                />
              ))}
            </div>

            {/* Image indicators */}
            {accommodation.images.length > 1 && (
              <div className="absolute bottom-3 left-0 right-0 flex justify-center space-x-2">
                {accommodation.images.map((_, index) => (
                  <button
                    key={index}
                    className={`w-2 h-2 rounded-full transition-all ${index === currentImageIndex ? 'bg-white w-4' : 'bg-white/40'}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      setCurrentImageIndex(index);
                    }}
                  ></button>
                ))}
              </div>
            )}
          </>
        ) : (
          <img 
            className="w-full h-full object-cover" 
            src={getImageUrl(accommodation)} 
            alt={accommodation.name} 
          />
        )}
        
        {/* Price badge */}
        <div className="absolute top-3 right-3 bg-black text-white px-3 py-1 rounded-lg text-sm font-medium">
          {formatPrice(accommodation)}
        </div>

        {/* Verified badge */}
        {accommodation.verified && (
          <div className="absolute top-3 left-3 bg-green-600 text-white px-3 py-1 rounded-lg text-xs font-medium flex items-center">
            <svg className="w-3 h-3 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
            </svg>
            Verified
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-5">
        {/* Title and Rating */}
        <div className="flex justify-between items-start mb-3">
          <h3 className="font-semibold text-lg leading-tight line-clamp-1 text-[#030301]">{accommodation.name}</h3>
          
          {/* Rating display */}
          {(accommodation.rating || getAverageRating(accommodation)) && (
            <div className="flex items-center bg-yellow-100 px-2 py-0.5 rounded-lg">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z"/>
              </svg>
              <span className="ml-1 text-sm font-semibold">{accommodation.rating || getAverageRating(accommodation)}</span>
            </div>
          )}
        </div>


        
        {/* Amenities */}
        <div className="flex flex-wrap gap-2 mb-4">
          {accommodation.amenities?.slice(0, 3).map((amenity, index) => (
            <span 
              key={index}
              className="inline-block bg-neutral-100 rounded-full px-3 py-1 text-xs font-medium text-neutral-800"
            >
              {amenity}
            </span>
          ))}
          {accommodation.amenities && accommodation.amenities.length > 3 && (
            <span className="inline-block bg-neutral-100 rounded-full px-3 py-1 text-xs font-medium text-neutral-600">
              +{accommodation.amenities.length - 3} more
            </span>
          )}
        </div>

        {/* For gender or availableFor */}
        {(accommodation.gender || accommodation.availableFor) && (
          <div className="text-sm text-neutral-600 mb-3">
            <div className="flex items-center">
              <span className="text-gray-600">For:</span>
              <span className="ml-1 bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                {accommodation.availableFor || accommodation.gender}
              </span>
            </div>
          </div>
        )}
        
        {/* View Details button */}
        <div className="mt-auto pt-2">
          <button 
            onClick={(e) => {
              e.stopPropagation();
              navigate(`/accommodation/${accommodation._id || accommodation.id}`);
            }}
            className="w-full bg-black text-white py-2.5 px-4 rounded-xl font-medium text-sm hover:bg-neutral-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
          >
            View Details
          </button>
        </div>
      </div>
    </div>
  );
});

// Main component
const FixedHostelListingPage: React.FC = () => {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const navigate = useNavigate();
  const [accommodations, setAccommodations] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [genderFilter, setGenderFilter] = useState('all');
  const [foodTypeFilter, setFoodTypeFilter] = useState('all');
  const [sortOption, setSortOption] = useState('default');
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [accommodationsPerPage] = useState(10);
  
  // Roommate preference modal state
  const [isRoommateModalOpen, setIsRoommateModalOpen] = useState(false);
  const [roommatePreference, setRoommatePreference] = useState('');
  const [showRoommateSuccess, setShowRoommateSuccess] = useState(false);
  
  // Fetch accommodations on component mount
  useEffect(() => {
    const fetchAccommodations = async () => {
      try {
        setLoading(true);
        const rawData = await accommodationsApi.getAll();
        // Support different backend response shapes
        const list = Array.isArray(rawData)
          ? rawData
          : rawData?.accommodations || rawData?.data || rawData?.results || [];
        setAccommodations(Array.isArray(list) ? list : []);
        setError(null);
      } catch (err) {
        console.error('Error fetching accommodations:', err);
        setError('Failed to load accommodations. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    fetchAccommodations();
  }, []);

  // Filter accommodations based on gender and food type filters
  const filteredAccommodations = useMemo(() => {
    return accommodations.filter(accom => {
      // Gender filter
      if (genderFilter !== 'all') {
        const accommodationGender = accom.gender || accom.availableFor || '';
        if (genderFilter === 'boys' && !accommodationGender.toLowerCase().includes('male') && !accommodationGender.toLowerCase().includes('boys') && !accommodationGender.toLowerCase().includes('both')) {
          return false;
        }
        if (genderFilter === 'girls' && !accommodationGender.toLowerCase().includes('female') && !accommodationGender.toLowerCase().includes('girls') && !accommodationGender.toLowerCase().includes('both')) {
          return false;
        }
      }
      
      // Food type filter
      if (foodTypeFilter !== 'all') {
        // Check all possible places where food type information might be stored
        const features = accom.features || [];
        const amenitiesList = accom.amenities || [];
        
        // Check for "Veg" in features array (from admin panel)
        const hasVegInFeatures = features.some(feature => 
          feature === 'Veg' || feature.toLowerCase() === 'veg'
        );
        
        // Check for "Non-veg" in features array (from admin panel)
        const hasNonVegInFeatures = features.some(feature => 
          feature === 'Non-veg' || feature.toLowerCase() === 'non-veg'
        );
        
        // Check for veg-related terms in amenities
        const hasVegInAmenities = amenitiesList.some(amenity => 
          amenity.toLowerCase().includes('veg') && 
          !amenity.toLowerCase().includes('non-veg')
        );
        
        // Check for non-veg terms in amenities
        const hasNonVegInAmenities = amenitiesList.some(amenity => 
          amenity.toLowerCase().includes('non-veg')
        );
        
        // Also check the food object if it exists
        const foodInfo = accom.food || {};
        const isVegOnly = foodInfo.vegOnly === true;
        
        // Check vegOnly property directly on accommodation
        const directVegOnly = accom.vegOnly === true;
        
        if (foodTypeFilter === 'veg') {
          // For vegetarian, check all possible indicators
          if (!hasVegInFeatures && !hasVegInAmenities && !isVegOnly && !directVegOnly) {
            return false;
          }
        } else if (foodTypeFilter === 'non-veg') {
          // For non-vegetarian, check all possible indicators
          const isExplicitlyVegOnly = isVegOnly || directVegOnly;
          const hasAnyNonVegIndicator = hasNonVegInFeatures || hasNonVegInAmenities;
          
          // If it's explicitly veg-only and has no non-veg indicators, filter it out
          if (isExplicitlyVegOnly && !hasAnyNonVegIndicator) {
            return false;
          }
        }
      }
      
      return true;
    });
  }, [accommodations, genderFilter, foodTypeFilter]);

  // Helper function to extract price from accommodation
  const extractPrice = (accom: Accommodation): number => {
    if (accom.startingFrom) {
      // Extract numeric value from startingFrom string (e.g., "Starting from ₹8,000" -> 8000)
      const match = accom.startingFrom.match(/[₹]?([0-9,]+)/);
      if (match) {
        return parseInt(match[1].replace(/,/g, ''));
      }
    }
    return accom.price || 0;
  };

  // Sort accommodations
  const sortedAccommodations = useMemo(() => {
    const accoms = [...filteredAccommodations];
    switch (sortOption) {
      case 'price-low-high':
        return accoms.sort((a, b) => extractPrice(a) - extractPrice(b));
      case 'price-high-low':
        return accoms.sort((a, b) => extractPrice(b) - extractPrice(a));
      default:
        return accoms;
    }
  }, [filteredAccommodations, sortOption]);

  const resetFilters = () => {
    setGenderFilter('all');
    setFoodTypeFilter('all');
    setSortOption('default');
  };

  // Handle roommate preference submission
  const handleRoommatePreferenceSubmit = () => {
    // This is frontend-only, so we just show a success message
    setShowRoommateSuccess(true);
    
    // Hide success message after 3 seconds
    setTimeout(() => {
      setShowRoommateSuccess(false);
      setIsRoommateModalOpen(false);
      setRoommatePreference('');
    }, 3000);
  };

  return (
    <div className="space-y-8">
      {/* Filter Section */}
      <div className="bg-[#fff9ed] p-6 rounded-xl shadow-sm border border-neutral-100">
        <div className="flex flex-col md:flex-row gap-4">
          {/* Gender Filter */}
          <div className="w-full md:w-60">
            <div className="relative">
              <select
                className="block appearance-none w-full pl-4 pr-10 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-black focus:border-black sm:text-sm bg-[#fff9ed] transition-colors"
                value={genderFilter}
                onChange={(e) => setGenderFilter(e.target.value)}
              >
                <option value="all">All Genders</option>
                <option value="boys">Boys Only</option>
                <option value="girls">Girls Only</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Food Type Filter */}
          <div className="w-full md:w-60">
            <div className="relative">
              <select
                className="block appearance-none w-full pl-4 pr-10 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-black focus:border-black sm:text-sm bg-[#fff9ed] transition-colors"
                value={foodTypeFilter}
                onChange={(e) => setFoodTypeFilter(e.target.value)}
              >
                <option value="all">All Food Types</option>
                <option value="veg">Vegetarian Only</option>
                <option value="non-veg">Non-Vegetarian</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Price Filter removed as requested */}
          
          {/* Sort Dropdown */}
          <div className="w-full md:w-60">
            <div className="relative">
              <select
                className="block appearance-none w-full pl-4 pr-10 py-3 text-base border border-neutral-200 rounded-xl focus:outline-none focus:ring-black focus:border-black sm:text-sm bg-[#fff9ed] transition-colors"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
              >
                <option value="default">Sort By: Recommended</option>
                <option value="price-low-high">Price: Low to High</option>
                <option value="price-high-low">Price: High to Low</option>
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-4 text-neutral-500">
                <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>
          
          {/* Reset Filters and Roommate Preference Buttons */}
          <div className="w-full md:w-auto flex space-x-3">
            <button
              onClick={resetFilters}
              className="w-full md:w-auto px-4 py-2 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              Reset Filters
            </button>
            <button
              onClick={() => setIsRoommateModalOpen(true)}
              className="w-full md:w-auto px-4 py-2 text-sm font-medium text-white bg-black rounded-xl hover:bg-gray-800 transition-colors focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-black"
            >
              Roommate Preference
            </button>
          </div>
        </div>

        {/* Filter Tags */}
        <div className="flex flex-wrap gap-2 mt-4">
          {genderFilter !== 'all' && (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
              {genderFilter === 'boys' ? 'Boys Only' : 'Girls Only'}
              <button
                onClick={() => setGenderFilter('all')}
                className="ml-1 focus:outline-none"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
          {foodTypeFilter !== 'all' && (
            <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800">
              {foodTypeFilter === 'veg' ? '🥗 Vegetarian Only' : '🍖 Non-Vegetarian'}
              <button
                onClick={() => setFoodTypeFilter('all')}
                className="ml-1 focus:outline-none"
              >
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </div>
          )}
        </div>
      </div>
      
      {/* Results Section */}
      <div>
        {loading ? (
          <div className="flex justify-center items-center py-16">
            <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-black"></div>
          </div>
        ) : error ? (
          <div className="bg-red-50 border border-red-200 text-red-700 px-6 py-4 rounded-xl" role="alert">
            <div className="flex">
              <svg className="w-5 h-5 mr-2 mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              <div>
                <strong className="font-medium">Error: </strong>
                <span className="block sm:inline">{error}</span>
              </div>
            </div>
          </div>
        ) : sortedAccommodations.length === 0 ? (
          <div className="bg-[#fff9ed] border border-neutral-100 rounded-xl shadow-sm text-center py-16 px-4">
            <svg className="mx-auto h-16 w-16 text-neutral-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <h3 className="mt-4 text-lg font-medium text-neutral-900">No accommodations found</h3>
            <p className="mt-2 text-neutral-500 max-w-md mx-auto">
              {genderFilter !== 'all' || foodTypeFilter !== 'all' ? "No accommodations match your selected filters." : "There are no accommodations available at the moment."}
            </p>
          </div>
        ) : (
          <>
            <div className="flex justify-between items-center mb-6">
              {/* Showing count removed as requested */}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-8">
              {sortedAccommodations
                .slice((currentPage - 1) * accommodationsPerPage, currentPage * accommodationsPerPage)
                .map((accommodation) => (
                  <HostelCard
                    key={accommodation._id || accommodation.id}
                    accommodation={accommodation}
                  />
                ))}
            </div>
            
            {/* Pagination Controls */}
            {sortedAccommodations.length > accommodationsPerPage && (
              <div className="mt-8 flex justify-center">
                <div className="flex items-center space-x-2">
                  <button
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-black border border-gray-300 hover:bg-gray-50'}`}
                  >
                    Previous
                  </button>
                  
                  <div className="text-sm text-gray-700">
                    <span className="font-medium">{Math.min((currentPage - 1) * accommodationsPerPage + 1, sortedAccommodations.length)}</span> - <span className="font-medium">{Math.min(currentPage * accommodationsPerPage, sortedAccommodations.length)}</span> of <span className="font-medium">{sortedAccommodations.length}</span>
                  </div>
                  
                  <button
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, Math.ceil(sortedAccommodations.length / accommodationsPerPage)))}
                    disabled={currentPage >= Math.ceil(sortedAccommodations.length / accommodationsPerPage)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-colors ${currentPage >= Math.ceil(sortedAccommodations.length / accommodationsPerPage) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-black border border-gray-300 hover:bg-gray-50'}`}
                  >
                    Next
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>

      {/* Roommate Preference Modal */}
      {isRoommateModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl p-6 max-w-md w-full">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-semibold">Roommate Preference</h3>
              <button 
                onClick={() => setIsRoommateModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {showRoommateSuccess ? (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg mb-4">
                <div className="flex items-center">
                  <svg className="h-5 w-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                  </svg>
                  <p>Your roommate preference has been submitted successfully!</p>
                </div>
              </div>
            ) : (
              <>
                <p className="text-gray-600 mb-4">
                  Tell us what kind of roommate you're looking for, and we'll do our best to find you the perfect match.
                </p>
                <textarea
                  value={roommatePreference}
                  onChange={(e) => setRoommatePreference(e.target.value)}
                  placeholder="Describe your ideal roommate (e.g., study habits, sleeping schedule, cleanliness preferences, etc.)"
                  className="w-full h-32 p-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-black focus:border-transparent"
                />
                <div className="mt-6 flex justify-end">
                  <button
                    onClick={() => setIsRoommateModalOpen(false)}
                    className="mr-3 px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleRoommatePreferenceSubmit}
                    disabled={!roommatePreference.trim()}
                    className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors ${roommatePreference.trim() ? 'bg-black hover:bg-gray-800' : 'bg-gray-400 cursor-not-allowed'}`}
                  >
                    Submit
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default FixedHostelListingPage;
