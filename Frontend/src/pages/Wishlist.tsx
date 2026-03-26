import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { getWishlist, removeFromWishlist } from '../services/wishlistService';
import SharedNavbar from '../components/SharedNavbar';
import Slider from "react-slick";
import "slick-carousel/slick/slick.css";
import "slick-carousel/slick/slick-theme.css";

interface Accommodation {
  _id: string;
  uniqueCode: string;
  type: string;
  nearestCollege: string[];
  nearestMetro: string;
  startingFrom: string;
  description: string;
  amenities: string[];
  images: string[];
}

const Wishlist: React.FC = () => {
  const [wishlistItems, setWishlistItems] = useState<Accommodation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    // If we are still loading auth state, do nothing
    if (authLoading) {
      return;
    }

    // If not authenticated, redirect to login
    if (!user) {
      navigate('/login');
      return;
    }

    const fetchWishlist = async () => {
      try {
        setLoading(true);
        const data = await getWishlist();
        setWishlistItems(data.data || []);
        setError(null);
      } catch (err: any) {
        // Handle error but don't redirect to login unless token is invalid
        // This prevents unnecessary redirects when already logged in
        if (err.response?.status === 401) {
          // Only redirect if token is invalid/expired
          console.error('Authentication error:', err);
          navigate('/login');
          return;
        }
        
        // For other errors, just show the error message
        setError(err.response?.data?.message || 'Failed to load wishlist');
        console.error('Error fetching wishlist:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchWishlist();
  }, [user, authLoading, navigate]);

  const handleRemoveFromWishlist = async (accommodationId: string) => {
    try {
      await removeFromWishlist(accommodationId);
      setWishlistItems(prevItems => prevItems.filter(item => item._id !== accommodationId));
    } catch (err: any) {
      console.error('Error removing from wishlist:', err);
      setError(err.response?.data?.message || 'Failed to remove from wishlist');
    }
  };

  const handleViewDetails = (accommodationId: string) => {
    navigate(`/accommodation/${accommodationId}`);
  };

  return (
    <div className="min-h-screen" style={{ backgroundColor: '#fff9ed' }}>
      <SharedNavbar />
      <div className="container mx-auto py-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-black mb-8">My Wishlist</h1>

          {loading ? (
            <div className="flex justify-center my-8">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
            </div>
          ) : error ? (
            <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
              {error}
            </div>
          ) : wishlistItems.length === 0 ? (
            <div className="bg-yellow-50 border border-yellow-200 rounded-md p-6 text-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="mx-auto h-12 w-12 text-yellow-400"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
                />
              </svg>
              <h3 className="mt-3 text-lg font-medium text-gray-900">Your wishlist is empty</h3>
              <p className="mt-2 text-gray-500">
                Browse accommodations and click the heart icon to add them to your wishlist.
              </p>
              <button
                onClick={() => navigate('/accommodation')}
                className="mt-4 inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md shadow-sm text-white bg-black hover:bg-neutral-800 focus:outline-none"
              >
                Browse Accommodations
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {wishlistItems.map((accommodation) => (
                <div
                  key={accommodation._id}
                  className="border border-neutral-200 rounded-lg overflow-hidden shadow-sm hover:shadow-md transition-shadow duration-200"
                >
                  <div className="relative h-48 overflow-hidden">
                    {accommodation.images && accommodation.images.length > 0 ? (
                      <Slider
                        dots={true}
                        infinite={true}
                        speed={500}
                        slidesToShow={1}
                        slidesToScroll={1}
                        autoplay={true}
                        autoplaySpeed={3000}
                      >
                        {accommodation.images.map((image, index) => (
                          <div key={index}>
                            <img
                              src={image}
                              alt={`${accommodation.uniqueCode} image ${index}`}
                              className="w-full h-48 object-cover"
                            />
                          </div>
                        ))}
                      </Slider>
                    ) : (
                      <div className="w-full h-full bg-gray-200 flex items-center justify-center">
                        <span className="text-gray-400">No image available</span>
                      </div>
                    )}
                    <button
                      onClick={() => handleRemoveFromWishlist(accommodation._id)}
                      className="absolute top-2 right-2 p-2 bg-white rounded-full shadow-md hover:bg-gray-100 z-10"
                      aria-label="Remove from wishlist"
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        fill="currentColor"
                        viewBox="0 0 24 24"
                        strokeWidth={1.5}
                        stroke="currentColor"
                        className="w-5 h-5 text-red-500"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12Z"
                        />
                      </svg>
                    </button>
                  </div>
                  <div className="p-4">
                    <h3 className="font-medium text-lg text-black">{accommodation.uniqueCode.toUpperCase()} - {accommodation.type}</h3>
                    
                    {/* Price */}
                    <div className="flex items-center mb-3">
                      <span className="text-gray-600 font-medium">
                        Starting from ₹{parseFloat(accommodation.startingFrom || '0').toFixed(2)}
                      </span>
                    </div>
                    
                    {/* Description - truncated */}
                    {accommodation.description && (
                      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                        {accommodation.description}
                      </p>
                    )}
                    
                    {/* Amenities */}
                    <div className="flex flex-wrap gap-1 mb-3">
                      {accommodation.amenities && accommodation.amenities.slice(0, 3).map((amenity, idx) => (
                        <span 
                          key={idx} 
                          className="bg-gray-100 text-gray-600 text-xs px-2 py-1 rounded-full"
                        >
                          {amenity}
                        </span>
                      ))}
                      {accommodation.amenities && accommodation.amenities.length > 3 && (
                        <span className="text-xs text-gray-500">+{accommodation.amenities.length - 3} more</span>
                      )}
                    </div>
                    
                    {/* Action buttons */}
                    <button
                      onClick={() => handleViewDetails(accommodation._id)}
                      className="w-full mt-2 px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800 transition-colors"
                    >
                      View Details
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Wishlist;
