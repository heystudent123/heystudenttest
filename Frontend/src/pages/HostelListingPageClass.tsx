import React, { Component } from 'react';
import { accommodationsApi } from '../services/api';

// Define the Accommodation interface
interface Accommodation {
  _id: string;
  name: string;
  description: string;
  type: 'PG' | 'Hostel' | 'Flat' | 'Other';
  address: {
    street: string;
    area: string;
    city: string;
    pincode: string;
  };
  rent: number;
  averageRating?: number;
  reviews: Array<any>;
  images: string[];
  amenities: string[];
  food: {
    available: boolean;
    vegOnly: boolean;
    mealTypes: string[];
  };
  nearestCollege: string[];
  distanceFromCollege: number;
  availableFor: 'Boys' | 'Girls' | 'Both';
}

// Component state interface
interface State {
  accommodations: Accommodation[];
  filteredAccommodations: Accommodation[];
  loading: boolean;
  error: string | null;
  searchQuery: string;
  selectedType: string;
  sortBy: string;
}

// Simple placeholder image
const FALLBACK_IMAGE = 'data:image/svg+xml,%3Csvg xmlns="http://www.w3.org/2000/svg" width="600" height="400" viewBox="0 0 600 400"%3E%3Crect width="600" height="400" fill="%23e2e8f0"%3E%3C/rect%3E%3Ctext x="50%25" y="50%25" dominant-baseline="middle" text-anchor="middle" font-family="system-ui, sans-serif" font-size="24" fill="%2364748b"%3EImage Unavailable%3C/text%3E%3C/svg%3E';

// Class component that doesn't use hooks at all
class HostelListingPageClass extends Component<{}, State> {
  listingRef: React.RefObject<HTMLDivElement>;
  
  constructor(props: {}) {
    super(props);
    this.state = {
      accommodations: [],
      filteredAccommodations: [],
      loading: true,
      error: null,
      searchQuery: '',
      selectedType: 'all',
      sortBy: 'price-low'
    };
    
    this.listingRef = React.createRef();
    
    // Bind methods
    this.handleFilterChange = this.handleFilterChange.bind(this);
    this.scrollToListings = this.scrollToListings.bind(this);
    this.handleQuickSearch = this.handleQuickSearch.bind(this);
    this.sortAccommodations = this.sortAccommodations.bind(this);
  }
  
  // Lifecycle method - will only run once
  componentDidMount() {
    this.fetchAccommodations();
  }
  
  // Fetch accommodations from API
  fetchAccommodations() {
    this.setState({ loading: true, error: null });
    
    accommodationsApi.getAll()
      .then(response => {
        this.setState({
          accommodations: response.data,
          filteredAccommodations: response.data,
          loading: false
        });
      })
      .catch(err => {
        console.error('Failed to fetch accommodations:', err);
        this.setState({
          error: 'Failed to load accommodations. Please try again later.',
          loading: false
        });
      });
  }
  
  // Handle filter changes
  handleFilterChange(filters: any) {
    this.setState({ loading: true });
    
    setTimeout(() => {
      const filtered = this.state.accommodations.filter((acc: Accommodation) => {
        // Filter by price
        if (acc.rent < filters.priceRange[0] || acc.rent > filters.priceRange[1]) {
          return false;
        }

        // Filter by college if specified
        if (filters.college && !acc.nearestCollege.includes(filters.college)) {
          return false;
        }

        // Filter by mess type
        if (filters.messType) {
          if (filters.messType === 'veg' && (!acc.food.available || !acc.food.vegOnly)) {
            return false;
          } else if (filters.messType === 'non-veg' && (!acc.food.available || acc.food.vegOnly)) {
            return false;
          } else if (filters.messType === 'both' && !acc.food.available) {
            return false;
          }
        }

        // Filter by amenities
        if (filters.amenities.length > 0) {
          const hasAllAmenities = filters.amenities.every((amenity: string) =>
            acc.amenities.includes(amenity)
          );
          if (!hasAllAmenities) {
            return false;
          }
        }

        return true;
      });

      this.setState({
        filteredAccommodations: filtered,
        loading: false
      });
    }, 100);
  }
  
  // Scroll to listings section
  scrollToListings() {
    this.listingRef.current?.scrollIntoView({ behavior: 'smooth' });
  }
  
  // Handle quick search
  handleQuickSearch() {
    const { searchQuery, selectedType } = this.state;
    
    // Apply quick search filters
    const filtered = this.state.accommodations.filter((acc: Accommodation) => {
      // Filter by search query
      if (searchQuery && !acc.name.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !acc.address.area.toLowerCase().includes(searchQuery.toLowerCase()) &&
          !acc.nearestCollege.some(college => college.toLowerCase().includes(searchQuery.toLowerCase()))) {
        return false;
      }
      
      // Filter by type
      if (selectedType !== 'all' && acc.type !== selectedType) {
        return false;
      }
      
      return true;
    });
    
    this.setState({
      filteredAccommodations: filtered
    });
    
    // Scroll to listings
    this.scrollToListings();
  }
  
  // Sort accommodations
  sortAccommodations(accs: Accommodation[]) {
    const { sortBy } = this.state;
    
    switch (sortBy) {
      case 'price-low':
        return [...accs].sort((a, b) => a.rent - b.rent);
      case 'price-high':
        return [...accs].sort((a, b) => b.rent - a.rent);
      case 'rating':
        return [...accs].sort((a, b) => (b.averageRating || 0) - (a.averageRating || 0));
      case 'distance':
        return [...accs].sort((a, b) => a.distanceFromCollege - b.distanceFromCollege);
      default:
        return accs;
    }
  }
  
  render() {
    const { filteredAccommodations, loading, error, sortBy } = this.state;
    const sortedAccommodations = this.sortAccommodations(filteredAccommodations);
    
    return (
      <div className="min-h-screen bg-neutral pt-16">
        {/* Hero Section */}
        <div className="relative min-h-[70vh] overflow-hidden" style={{ backgroundColor: 'red' }}>
          <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-24 lg:pt-32 lg:pb-36">
            <div className="flex flex-col items-center justify-center text-center">
              <h1 className="font-display font-bold tracking-tight text-neutral-900">
                <span className="block mb-2">Find Your Perfect</span>
                <span className="text-accent">Student Accommodation</span>
              </h1>
            </div>
          </div>
        </div>
        
        {/* Main Content */}
        <div ref={this.listingRef} className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
          {/* Accommodations List */}
          <div className="flex-1">
            {/* Results header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-6">
              <h2 className="text-2xl font-display font-bold text-neutral-dark">
                {filteredAccommodations.length} {filteredAccommodations.length === 1 ? 'Accommodation' : 'Accommodations'} Found
              </h2>
              
              <div className="mt-3 sm:mt-0 flex items-center">
                <label htmlFor="sort" className="mr-2 text-sm text-gray-500">Sort by:</label>
                <select
                  id="sort"
                  value={sortBy}
                  onChange={(e) => this.setState({ sortBy: e.target.value })}
                  className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-accent focus:border-accent sm:text-sm rounded-md"
                >
                  <option value="price-low">Price: Low to High</option>
                  <option value="price-high">Price: High to Low</option>
                  <option value="rating">Rating</option>
                  <option value="distance">Distance to College</option>
                </select>
              </div>
            </div>
            
            {/* Error state */}
            {error && (
              <div className="bg-red-100 border border-red-200 text-red-700 px-4 py-3 rounded-lg mb-6">
                <p>{error}</p>
              </div>
            )}
            
            {/* Accommodation cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {loading ? (
                // Loading placeholders
                Array(6).fill(0).map((_, idx) => (
                  <div 
                    key={`loading-${idx}`}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 h-[400px] overflow-hidden"
                  >
                    <div className="h-[225px] bg-gray-200"></div>
                    <div className="p-4">
                      <div className="h-6 bg-gray-200 rounded w-3/4 mb-2"></div>
                      <div className="h-4 bg-gray-200 rounded w-1/2 mb-4"></div>
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="h-4 bg-gray-200 rounded w-full mb-2"></div>
                        <div className="h-4 bg-gray-200 rounded w-2/3 mb-4"></div>
                        <div className="flex gap-2">
                          <div className="h-8 bg-gray-200 rounded w-20"></div>
                          <div className="h-8 bg-gray-200 rounded w-20"></div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                // Actual accommodation cards
                sortedAccommodations.map((accommodation) => (
                  <div
                    key={accommodation._id}
                    className="bg-white rounded-lg shadow-sm border border-gray-200 h-[400px] overflow-hidden cursor-pointer"
                    onClick={() => window.location.href = `/accommodations/${accommodation._id}`}
                  >
                    <div 
                      className="h-[225px] bg-gray-100 relative"
                      style={{
                        backgroundImage: `url(${FALLBACK_IMAGE})`,
                        backgroundSize: 'cover',
                        backgroundPosition: 'center'
                      }}
                    >
                      <div className="absolute top-3 right-3 bg-white/90 px-3 py-1.5 rounded-full font-semibold shadow-sm">
                        <span className="text-sm">₹</span>
                        <span className="text-base">{accommodation.rent.toLocaleString()}</span>
                        <span className="text-xs text-gray-500">/mo</span>
                      </div>
                    </div>
                    
                    <div className="p-4">
                      <h3 className="text-lg font-semibold text-gray-900 truncate">{accommodation.name}</h3>
                      <p className="text-gray-500 text-sm mt-1 truncate">
                        {accommodation.address.area}, {accommodation.address.city}
                      </p>
                      
                      <div className="mt-4 pt-4 border-t border-gray-100">
                        <div className="flex flex-col gap-2">
                          <div className="flex items-center text-xs text-gray-600">
                            <span>🏫 {accommodation.distanceFromCollege}km to {accommodation.nearestCollege[0]}</span>
                          </div>
                          <div className="flex items-center text-xs text-gray-600">
                            <span>{accommodation.food.vegOnly ? '🥗 Veg Only' : '🍽️ Veg & Non-veg'}</span>
                          </div>
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {accommodation.amenities.slice(0, 3).map((amenity, index) => (
                              <span key={index} className="bg-gray-50 text-xs px-2 py-1 rounded-md text-gray-700">
                                {amenity}
                              </span>
                            ))}
                            {accommodation.amenities.length > 3 && (
                              <span className="bg-gray-50 text-xs px-2 py-1 rounded-md text-gray-700">
                                +{accommodation.amenities.length - 3}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }
}

export default HostelListingPageClass;
