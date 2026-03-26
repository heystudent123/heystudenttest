import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import api from '../services/api';

// Address interface removed as per requirements

interface Accommodation {
  _id: string;
  title?: string;
  description: string;
  startingFrom: string; // Changed from priceRange to startingFrom
  type: string;
  images: string[];
  availableFor?: string; // Backend field
  uniqueCode: string; // Now required
  features: string[];
  nearestCollege?: string;
  distanceFromCollege?: number;
  nearestMetro?: string;
  distanceFromMetro?: number;
}

const AMENITIES = [
  'Fully furnished AC room',
  'Unlimited laundry',
  'High speed wifi up to 100mbps',
  'R-O water',
  'Dining area',
  'Hygienic meal',
  'Medical Facility',
  'Daily cleaning',
  'Attached Bathroom',
  'Fridge in Dinning Area',
  'CCTV Surveillance'
];

// Special food preference options that won't be included in Select All
const FOOD_PREFERENCES = [
  'Veg',
  'Non-veg'
];

const AdminAccommodationEditPage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  
  const [accommodation, setAccommodation] = useState<Accommodation>({
    _id: '',
    title: '',
    description: '',
    startingFrom: '',
    type: 'PG', // Default type set to PG
    images: [],
    uniqueCode: '',
    availableFor: '',
    features: [],
    nearestCollege: '',
    distanceFromCollege: undefined,
    nearestMetro: '',
    distanceFromMetro: undefined
  });

  // Image link states
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const [imageLinks, setImageLinks] = useState<string[]>([]);
  const [imageInputs, setImageInputs] = useState<string[]>(['', '', '', '', '', '']);
  
  // State for uniqueCode validation
  const [isCheckingUniqueCode, setIsCheckingUniqueCode] = useState(false);
  const [uniqueCodeError, setUniqueCodeError] = useState('');
  
  

  // Handle image input change
  const handleImageInputChange = (index: number, value: string) => {
    const newImageInputs = [...imageInputs];
    newImageInputs[index] = value;
    setImageInputs(newImageInputs);
  };

  // Clear image input
  const clearImageInput = (index: number) => {
    const newImageInputs = [...imageInputs];
    newImageInputs[index] = '';
    setImageInputs(newImageInputs);
  }

  
  useEffect(() => {
    // Fetch accommodation details if in edit mode
    const fetchAccommodation = async () => {
      try {
        const response = await api.get(`/accommodations/${id}`);
        const fetched = response.data.data;
        setAccommodation({
          ...fetched,
          features: fetched.features ?? fetched.amenities ?? [],
          images: fetched.images ?? [],
          startingFrom: fetched.startingFrom ?? fetched.priceRange ?? ''
        });
        
        // Populate image inputs with existing images
        const existingImages = response.data.data.images || [];
        const newImageInputs = [...imageInputs];
        existingImages.forEach((img: string, idx: number) => {
          if (idx < 6) {
            newImageInputs[idx] = img;
          }
        });
        setImageInputs(newImageInputs);
        setImageLinks(existingImages);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching accommodation:', err);
        setError(err.response?.data?.message || 'Failed to fetch accommodation details');
        setLoading(false);
      }
    };

    if (id) {
      fetchAccommodation();
    } else {
      setLoading(false);
    }
  }, [id, navigate, imageInputs]);

  // Amenity helpers
const toggleAmenity = (amenity: string) => {
  setAccommodation(prev => {
    const exists = prev.features.includes(amenity);
    const newFeatures = exists ? prev.features.filter(f => f !== amenity) : [...prev.features, amenity];
    return { ...prev, features: newFeatures };
  });
};

const handleSelectAllAmenities = (e: React.ChangeEvent<HTMLInputElement>) => {
  // Keep any existing food preferences when toggling all amenities
  const currentFoodPrefs = accommodation.features.filter(feature => 
    FOOD_PREFERENCES.includes(feature)
  );
  
  if (e.target.checked) {
    // Add all standard amenities while preserving food preferences
    setAccommodation(prev => ({ 
      ...prev, 
      features: [...AMENITIES, ...currentFoodPrefs]
    }));
  } else {
    // Remove all standard amenities but keep food preferences
    setAccommodation(prev => ({ 
      ...prev, 
      features: currentFoodPrefs 
    }));
  }
};

// Check if uniqueCode already exists
  const checkUniqueCode = async (code: string) => {
    if (!code.trim()) return;
    
    try {
      setIsCheckingUniqueCode(true);
      setUniqueCodeError('');

      const response = await api.get(`/accommodations/check-unique-code/${code}`);
      
      // If response contains exists=true and it's not the current accommodation being edited
      if (response.data.exists && (!id || response.data.id !== id)) {
        setUniqueCodeError('This unique code already exists. Please use a different code.');
        return true; // Code exists
      }
      
      return false; // Code doesn't exist or belongs to current accommodation
    } catch (err: any) {
      console.error('Error checking unique code:', err);
      // Only set error if it's specifically about uniqueness
      if (err.response?.status === 409) {
        setUniqueCodeError('This unique code already exists. Please use a different code.');
        return true;
      }
      return false;
    } finally {
      setIsCheckingUniqueCode(false);
    }
  };

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    
    // Update the accommodation state
    setAccommodation(prev => ({
      ...prev,
      [name]: value
    }));
    
    // Check uniqueCode when it changes
    if (name === 'uniqueCode' && value.trim()) {
      // Use a debounce effect for better UX
      const timeoutId = setTimeout(() => {
        checkUniqueCode(value);
      }, 500);
      
      return () => clearTimeout(timeoutId);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Get all non-empty image links from the separate inputs
    const cleanedLinks = imageInputs
      .map(link => link.trim())
      .filter(link => link !== '');

    // Check if uniqueCode already exists before submitting
    const uniqueCodeExists = await checkUniqueCode(accommodation.uniqueCode);
    if (uniqueCodeExists) {
      // Don't proceed if uniqueCode already exists
      return;
    }

    setSubmitting(true);
    setError('');
    const payload = { ...accommodation, images: cleanedLinks };
    try {
      if (id) {
        await api.put(`/accommodations/${id}`, payload);
      } else {
        await api.post('/accommodations', payload);
      }
      navigate('/admin/accommodations');
    } catch (err: any) {
      console.error('Error saving accommodation:', err);
      if (err.response?.status === 409) {
        setError('This unique code already exists. Please use a different code.');
      } else {
        setError(err.response?.data?.message || 'Failed to save accommodation');
      }
    } finally {
      setSubmitting(false);
    }
  };
  
  // Helpers for combined location + distance fields
  const combinedMetroValue = `${accommodation.nearestMetro || ''}${accommodation.distanceFromMetro != null ? ', ' + accommodation.distanceFromMetro : ''}`;
  const combinedCollegeValue = `${accommodation.nearestCollege || ''}${accommodation.distanceFromCollege != null ? ', ' + accommodation.distanceFromCollege : ''}`;

  const handleMetroCombined = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [namePart, distPart] = e.target.value.split(',').map(s => s.trim());
    setAccommodation(prev => ({
      ...prev,
      nearestMetro: namePart || '',
      distanceFromMetro: distPart ? Number(distPart) : undefined
    }));
  };

  const handleCollegeCombined = (e: React.ChangeEvent<HTMLInputElement>) => {
    const [namePart, distPart] = e.target.value.split(',').map(s => s.trim());
    setAccommodation(prev => ({
      ...prev,
      nearestCollege: namePart || '',
      distanceFromCollege: distPart ? Number(distPart) : undefined
    }));
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">
            {id ? 'Edit Accommodation' : 'Add New Accommodation'}
          </h1>
          <Link
            to="/admin/accommodations"
            className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
          >
            Back to List
          </Link>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6">
            <div className="grid grid-cols-1 gap-y-4 sm:gap-6 sm:grid-cols-2">
              <div className="col-span-2">
                <label htmlFor="uniqueCode" className="block text-sm font-medium text-gray-700">
                  Unique Code <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    name="uniqueCode"
                    id="uniqueCode"
                    value={accommodation.uniqueCode || ''}
                    onChange={handleChange}
                    required
                    className={`mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm ${uniqueCodeError ? 'border-red-500' : 'border-gray-300'} rounded-md`}
                  />
                  {isCheckingUniqueCode && (
                    <div className="absolute right-2 top-2">
                      <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-primary"></div>
                    </div>
                  )}
                </div>
                {uniqueCodeError && (
                  <p className="mt-1 text-sm text-red-600">{uniqueCodeError}</p>
                )}
              </div>

              <div>
                <label htmlFor="availableFor" className="block text-sm font-medium text-gray-700">
                  Accommodation For
                </label>
                <select
                  name="availableFor"
                  id="availableFor"
                  value={accommodation.availableFor || ''}
                  onChange={handleChange}
                  className="mt-1 block w-full py-2 px-3 border border-gray-300 bg-white rounded-md shadow-sm focus:outline-none focus:ring-primary focus:border-primary sm:text-sm"
                >
                  <option value="">Select</option>
                  <option value="Boys">Boys</option>
                  <option value="Girls">Girls</option>
                  <option value="Both">Co-ed</option>
                </select>
              </div>

              <div>
                <label htmlFor="startingFrom" className="block text-sm font-medium text-gray-700">
                  Starting From <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  name="startingFrom"
                  id="startingFrom"
                  value={accommodation.startingFrom || ''}
                  onChange={handleChange}
                  placeholder="e.g., ₹5,000"
                  className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                  required
                />
              </div>

              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Image Links (6 separate fields)
                </label>
                {imageInputs.map((url, idx) => (
                  <div key={idx} className="flex flex-col sm:flex-row gap-2 mt-3 items-start sm:items-center">
                    <div className="flex-grow w-full">
                      <div className="flex flex-col sm:flex-row gap-2">
                        <input
                          type="url"
                          value={url}
                          onChange={(e) => handleImageInputChange(idx, e.target.value)}
                          className="flex-1 focus:ring-primary focus:border-primary block w-full text-sm border-gray-300 rounded-md"
                          placeholder={`Image ${idx + 1} URL`}
                        />
                        {url && (
                          <button 
                            type="button" 
                            onClick={() => clearImageInput(idx)} 
                            className="mt-1 sm:mt-0 px-3 py-1 bg-red-500 text-white rounded-md w-full sm:w-auto"
                          >
                            Clear
                          </button>
                        )}
                      </div>
                    </div>
                    {url && (
                      <div className="w-16 h-16 flex-shrink-0 mt-2 sm:mt-0">
                        <img src={url} alt={`img-${idx}`} className="w-full h-full object-cover rounded-md" />
                      </div>
                    )}
                  </div>
                ))}
              </div>

              <div>
                <label htmlFor="nearestMetroCombined" className="block text-sm font-medium text-gray-700">Nearest Metro & Distance (km) — comma separated</label>
                <input
                  type="text"
                  name="nearestMetroCombined"
                  id="nearestMetroCombined"
                  placeholder="Hauz Khas, 0.5"
                  value={combinedMetroValue}
                  onChange={handleMetroCombined}
                  className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>

              <div>
                <label htmlFor="nearestCollegeCombined" className="block text-sm font-medium text-gray-700">Nearest College & Distance (km) — comma separated</label>
                <input
                  type="text"
                  name="nearestCollegeCombined"
                  id="nearestCollegeCombined"
                  placeholder="IIT Delhi, 1.2"
                  value={combinedCollegeValue}
                  onChange={handleCollegeCombined}
                  className="mt-1 focus:ring-primary focus:border-primary block w-full shadow-sm sm:text-sm border-gray-300 rounded-md"
                />
              </div>


              <div className="col-span-2">
                <label className="block text-sm font-medium text-gray-700">
                  Amenities (facilities)
                </label>
                {/* Select All */}
                <div className="flex items-center mt-1">
                  <input
                    type="checkbox"
                    id="amenities_all"
                    checked={(accommodation.features?.length || 0) === AMENITIES.length}
                    onChange={handleSelectAllAmenities}
                    className="h-4 w-4 text-primary border-gray-300 rounded"
                  />
                  <label htmlFor="amenities_all" className="ml-2 text-sm text-gray-700">
                    Select All
                  </label>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-2 mt-2">
                  {/* Food preferences section - these won't be included in Select All */}
                  <div className="col-span-2 mb-2 border-b pb-2">
                    <p className="text-sm font-medium text-gray-700 mb-1">Food Preferences:</p>
                    <div className="flex flex-wrap gap-x-6 gap-y-2">
                      {FOOD_PREFERENCES.map((preference) => (
                        <label key={preference} className="inline-flex items-center">
                          <input
                            type="checkbox"
                            className="h-4 w-4 text-primary border-gray-300 rounded"
                            checked={accommodation.features.includes(preference)}
                            onChange={() => toggleAmenity(preference)}
                          />
                          <span className="ml-2 text-sm text-gray-700">{preference}</span>
                        </label>
                      ))}
                    </div>
                  </div>
                  
                  {/* Regular amenities that are included in Select All */}
                  {AMENITIES.map((amenity) => (
                    <label key={amenity} className="inline-flex items-center py-1">
                      <input
                        type="checkbox"
                        className="h-4 w-4 text-primary border-gray-300 rounded"
                        checked={accommodation.features.includes(amenity)}
                        onChange={() => toggleAmenity(amenity)}
                      />
                      <span className="ml-2 text-sm text-gray-700">{amenity}</span>
                    </label>
                  ))}
                </div>
              </div>

              {/* Contact field removed as per requirements */}
                  
              <div className="col-span-2">
                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-primary hover:bg-primary/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary disabled:opacity-50"
                >
                  {submitting ? 'Saving...' : 'Save Accommodation'}
                </button>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default AdminAccommodationEditPage; 