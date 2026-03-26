import React, { useState, useEffect } from 'react';
import SharedNavbar from '../components/SharedNavbar';
import { coursesApi } from '../services/api';

interface Course {
  _id: string;
  title: string;
  description: string;
  subtitle?: string;
  category: string;
  duration: string;
  level: string;
  instructor?: string;
  price: number;
  originalPrice?: number;
  referralPrice?: number;
  isPaid: boolean;
  features?: string[];
  enrollmentLink?: string;
  image?: string;
  isActive: boolean;
  enrolledCount?: number;
  materials?: CourseMaterial[];
  createdAt: string;
}

interface CourseMaterial {
  _id: string;
  title: string;
  description?: string;
  materialType: 'file' | 'video' | 'link' | 'note' | 'pdf' | 'module' | 'pyq' | 'notes';
  // File fields
  fileUrl?: string;
  fileType?: string;
  // Video fields
  videoUrl?: string;
  videoPlatform?: string;
  // Link fields
  externalUrl?: string;
  // Note fields
  noteContent?: string;
  uploadedAt?: string;
  createdAt?: string;
}

const AdminCoursesPage: React.FC = () => {
  const [courses, setCourses] = useState<Course[]>([]);
  const [filteredCourses, setFilteredCourses] = useState<Course[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | null>(null);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [showMaterialsModal, setShowMaterialsModal] = useState(false);
  const [showAddMaterialForm, setShowAddMaterialForm] = useState(false);
  const [materialType, setMaterialType] = useState<'file' | 'video' | 'link' | 'note' | 'pdf' | 'module' | 'pyq' | 'notes'>('file');
  const [uploadingFile, setUploadingFile] = useState(false);

  // Material form state
  const [materialForm, setMaterialForm] = useState({
    title: '',
    description: '',
    videoUrl: '',
    externalUrl: '',
    noteContent: ''
  });

  // Form state
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    subtitle: '',
    category: [] as string[],
    duration: '',
    level: 'All Levels',
    price: '',
    originalPrice: '',
    referralPrice: '',
    isPaid: false,
    features: '',
    isActive: true
  });

  useEffect(() => {
    fetchCourses();
  }, []);

  const fetchCourses = async () => {
    try {
      const response = await coursesApi.getAll({ limit: 100 });
      const coursesData = response.data || response.courses || [];
      setCourses(coursesData);
      setFilteredCourses(coursesData);
    } catch (err: any) {
      console.error('Error fetching courses:', err);
      // Don't block the UI — just show empty state so the admin can still add courses
      setCourses([]);
      setFilteredCourses([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    const query = e.target.value.toLowerCase();
    setSearchQuery(query);
    
    if (query.trim() === '') {
      setFilteredCourses(courses);
      return;
    }
    
    const filtered = courses.filter(course => 
      course.title?.toLowerCase().includes(query) || 
      course.description?.toLowerCase().includes(query) ||
      course.category?.toLowerCase().includes(query) ||
      course.instructor?.toLowerCase().includes(query)
    );
    
    setFilteredCourses(filtered);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? (e.target as HTMLInputElement).checked : value
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const payload = {
        ...formData,
        category: formData.category,
        price: parseFloat(formData.price as string) || 0,
        originalPrice: parseFloat(formData.originalPrice as string) || 0,
        referralPrice: parseFloat(formData.referralPrice as string) || 0,
        features: formData.features
          ? formData.features.split('\n').map((f: string) => f.trim()).filter(Boolean)
          : []
      };

      if (editingCourse) {
        await coursesApi.update(editingCourse._id, payload);
      } else {
        await coursesApi.create(payload);
      }
      
      // Reset form and refresh courses
      setFormData({
        title: '',
        description: '',
        subtitle: '',
        category: [] as string[],
        duration: '',
        level: 'All Levels',
        price: '',
        originalPrice: '',
        referralPrice: '',
        isPaid: false,
        features: '',
        isActive: true
      });
      setShowAddForm(false);
      setEditingCourse(null);
      fetchCourses();
    } catch (err: any) {
      console.error('Error saving course:', err);
      alert('Failed to save course');
    }
  };

  const handleEdit = (course: Course) => {
    setEditingCourse(course);
    setFormData({
      title: course.title,
      description: course.description,
      subtitle: course.subtitle || '',
      category: Array.isArray(course.category) ? course.category : (course.category ? course.category.split(', ').map((s: string) => s.trim()).filter(Boolean) : []),
      duration: course.duration,
      level: course.level,
      price: course.price?.toString() ?? '',
      originalPrice: course.originalPrice?.toString() ?? '',
      referralPrice: course.referralPrice?.toString() ?? '',
      isPaid: course.isPaid,
      features: (course.features || []).join('\n'),
      isActive: course.isActive
    });
    setShowAddForm(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this course?')) {
      return;
    }

    try {
      await coursesApi.deleteCourse(id);
      fetchCourses();
    } catch (err: any) {
      console.error('Error deleting course:', err);
      alert('Failed to delete course');
    }
  };

  const handleCancel = () => {
    setShowAddForm(false);
    setEditingCourse(null);
    setFormData({
      title: '',
      description: '',
      subtitle: '',
      category: [] as string[],
      duration: '',
      level: 'All Levels',
      price: '',
      originalPrice: '',
      referralPrice: '',
      isPaid: false,
      features: '',
      isActive: true
    });
  };

  const toggleCategory = (cat: string) => {
    setFormData(prev => {
      const current = prev.category as string[];
      return {
        ...prev,
        category: current.includes(cat)
          ? current.filter(c => c !== cat)
          : [...current, cat]
      };
    });
  };

  const handleFileUpload = async (courseId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const title = prompt('Enter a title for this material:');
    if (!title) return;

    const description = prompt('Enter a description (optional):') || '';

    setUploadingFile(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('title', title);
      fd.append('description', description);
      fd.append('materialType', materialType);

      await coursesApi.uploadMaterial(courseId, fd);

      alert('File uploaded successfully!');
      setShowAddMaterialForm(false);
      await fetchCourses();
      
      // Refresh selected course if modal is open
      if (selectedCourse && selectedCourse._id === courseId) {
        const updatedCourse = courses.find(c => c._id === courseId);
        if (updatedCourse) setSelectedCourse(updatedCourse);
      }
    } catch (err: any) {
      console.error('Error uploading file:', err);
      alert('Failed to upload file');
    } finally {
      setUploadingFile(false);
      e.target.value = ''; // Reset file input
    }
  };

  const handleMaterialFormChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setMaterialForm(prev => ({ ...prev, [name]: value }));
  };

  const closeMaterialsModal = () => {
    setShowMaterialsModal(false);
    setSelectedCourse(null);
    setShowAddMaterialForm(false);
    setMaterialForm({ title: '', description: '', videoUrl: '', externalUrl: '', noteContent: '' });
  };

  const handleAddMaterial = async (courseId: string) => {
    if (!materialForm.title.trim()) {
      alert('Please enter a title');
      return;
    }
    try {
      const fd = new FormData();
      fd.append('title', materialForm.title);
      fd.append('description', materialForm.description);
      fd.append('materialType', materialType);
      if (materialType === 'video') fd.append('videoUrl', materialForm.videoUrl);
      if (materialType === 'link') fd.append('externalUrl', materialForm.externalUrl);
      if (materialType === 'note') fd.append('noteContent', materialForm.noteContent);
      await coursesApi.uploadMaterial(courseId, fd);
      alert('Material added successfully!');
      setShowAddMaterialForm(false);
      setMaterialForm({ title: '', description: '', videoUrl: '', externalUrl: '', noteContent: '' });
      await fetchCourses();
      if (selectedCourse && selectedCourse._id === courseId) {
        const updated = courses.find(c => c._id === courseId);
        if (updated) setSelectedCourse(updated);
      }
    } catch (err: any) {
      console.error('Error adding material:', err);
      alert('Failed to add material');
    }
  };

  const handleDeleteMaterial = async (courseId: string, materialId: string) => {
    if (!window.confirm('Are you sure you want to delete this material?')) return;
    try {
      await coursesApi.deleteMaterial(courseId, materialId);
      await fetchCourses();
      if (selectedCourse && selectedCourse._id === courseId) {
        const updated = courses.find(c => c._id === courseId);
        if (updated) setSelectedCourse(updated);
      }
    } catch (err: any) {
      console.error('Error deleting material:', err);
      alert('Failed to delete material');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-black"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-neutral-50">
      <SharedNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-black">Course Management</h1>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800"
          >
            + Add Course
          </button>
        </div>

        {/* Add / Edit Form */}
        {showAddForm && (
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold mb-4">{editingCourse ? 'Edit Course' : 'Add New Course'}</h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title *</label>
                <input name="title" value={formData.title} onChange={handleInputChange} required className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Description *</label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} rows={3} required className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Subtitle</label>
                <input name="subtitle" value={formData.subtitle} onChange={handleInputChange} className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
              </div>
              <div>
                <label className="block text-sm font-medium mb-2">Category</label>
                <div className="flex flex-wrap gap-2">
                  {['JEE', 'NEET', 'Class 11', 'Class 12', 'Foundation', 'Competitive', 'Other'].map(cat => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => toggleCategory(cat)}
                      className={`px-3 py-1 rounded-full text-sm border ${(formData.category as string[]).includes(cat) ? 'bg-black text-white border-black' : 'border-neutral-300 text-gray-700 hover:border-black'}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Duration</label>
                  <input name="duration" value={formData.duration} onChange={handleInputChange} placeholder="e.g., 3 months" className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Level</label>
                  <select name="level" value={formData.level} onChange={handleInputChange} className="w-full px-3 py-2 border border-neutral-300 rounded-md">
                    <option>All Levels</option>
                    <option>Beginner</option>
                    <option>Intermediate</option>
                    <option>Advanced</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Price (&#x20B9;)</label>
                  <input name="price" type="number" value={formData.price} onChange={handleInputChange} className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Original Price (&#x20B9;)</label>
                  <input name="originalPrice" type="number" value={formData.originalPrice} onChange={handleInputChange} className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Referral Price (&#x20B9;)</label>
                  <input name="referralPrice" type="number" value={formData.referralPrice} onChange={handleInputChange} className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
                </div>
              </div>
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isPaid" name="isPaid" checked={formData.isPaid} onChange={handleInputChange} className="rounded" />
                  <label htmlFor="isPaid" className="text-sm font-medium">Paid Course</label>
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="isActive" name="isActive" checked={formData.isActive} onChange={handleInputChange} className="rounded" />
                  <label htmlFor="isActive" className="text-sm font-medium">Active</label>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Features (one per line)</label>
                <textarea name="features" value={formData.features} onChange={handleInputChange} rows={4} placeholder="Live classes&#10;Recorded sessions&#10;Doubt clearing" className="w-full px-3 py-2 border border-neutral-300 rounded-md" />
              </div>
              <div className="flex gap-3">
                <button type="submit" className="px-6 py-2 bg-black text-white rounded-md hover:bg-neutral-800">
                  {editingCourse ? 'Update Course' : 'Add Course'}
                </button>
                <button type="button" onClick={handleCancel} className="px-6 py-2 bg-neutral-200 text-black rounded-md hover:bg-neutral-300">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}

        <div className="space-y-6">
          {/* Search Bar */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm p-4 mb-6">
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={handleSearch}
                placeholder="Search courses..."
                className="block w-full pl-10 pr-3 py-2 border border-neutral-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:placeholder-gray-400 focus:ring-2 focus:ring-black focus:border-black"
              />
            </div>
          </div>

          {/* Courses List */}
          <div className="bg-white border border-neutral-200 rounded-2xl shadow-sm overflow-hidden">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg leading-6 font-medium text-black">
                Courses ({filteredCourses.length})
              </h2>
            </div>
            
            <div className="border-t border-neutral-200">
              {filteredCourses.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-gray-500">No courses found</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-200">
                  {filteredCourses.map((course) => (
                    <div key={course._id} className="p-6 hover:bg-neutral-50 transition-colors">
                      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <h3 className="text-lg font-semibold text-black">{course.title}</h3>
                            <span className={`inline-block px-2 py-1 text-xs rounded-full ${
                              course.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
                            }`}>
                              {course.isActive ? 'Active' : 'Inactive'}
                            </span>
                            <span className="inline-block px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                              {course.category}
                            </span>
                          </div>
                          <p className="text-gray-600 text-sm mb-2">{course.description}</p>
                          <div className="flex flex-wrap gap-4 text-sm text-gray-500">
                            <span>📅 {course.duration}</span>
                            <span>📊 {course.level}</span>
                            {course.instructor && <span>👨‍🏫 {course.instructor}</span>}
                            <span>{course.isPaid ? `₹${course.price}` : 'Free'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {/* Materials button removed per request */}
                          <button
                            onClick={() => handleEdit(course)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-sm"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(course._id)}
                            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 text-sm"
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Materials Modal */}
      {showMaterialsModal && selectedCourse && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
            <div className="px-6 py-4 border-b border-neutral-200 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-black">
                Course Materials - {selectedCourse.title}
              </h2>
              <button
                onClick={closeMaterialsModal}
                className="text-gray-500 hover:text-black"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 overflow-y-auto flex-1">
              {/* Add Material Section */}
              <div className="mb-6 border border-neutral-200 rounded-lg p-4">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-semibold text-black">Add New Material</h3>
                  {!showAddMaterialForm && (
                    <button
                      onClick={() => setShowAddMaterialForm(true)}
                      className="px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800 text-sm"
                    >
                      + Add Material
                    </button>
                  )}
                </div>

                {showAddMaterialForm && (
                  <div className="space-y-4">
                    {/* Material Type Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">Material Type</label>
                      <select
                        value={materialType}
                        onChange={(e) => setMaterialType(e.target.value as 'file' | 'video' | 'link' | 'note' | 'pdf' | 'module' | 'pyq' | 'notes')}
                        className="w-full px-3 py-2 border border-neutral-300 rounded-md focus:outline-none focus:ring-2 focus:ring-black"
                      >
                        <option value="file">📄 General File</option>
                        <option value="pdf">📕 PDF Document</option>
                        <option value="pyq">📝 Previous Year Questions (PYQ)</option>
                        <option value="notes">📚 Notes</option>
                        <option value="module">📦 Course Module</option>
                        <option value="video">🎥 Video Link</option>
                        <option value="link">🔗 External Link</option>
                        <option value="note">📋 Text Note</option>
                      </select>
                    </div>

                    {/* File Upload */}
                    {(materialType === 'file' || materialType === 'pdf' || materialType === 'module' || materialType === 'pyq' || materialType === 'notes') && (
                      <div>
                        <label className="block mb-2">
                          <span className="px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800 cursor-pointer inline-block">
                            {uploadingFile ? 'Uploading...' : 
                              materialType === 'pdf' ? 'Choose PDF File' :
                              materialType === 'pyq' ? 'Choose PYQ File (PDF)' :
                              materialType === 'notes' ? 'Choose Notes File (PDF/DOC)' :
                              materialType === 'module' ? 'Choose Module Files (ZIP)' :
                              'Choose File (PDF, DOC, Image)'}
                          </span>
                          <input
                            type="file"
                            onChange={(e) => handleFileUpload(selectedCourse!._id, e)}
                            accept={
                              materialType === 'pdf' ? '.pdf' :
                              materialType === 'module' ? '.zip,.rar' :
                              '.pdf,.doc,.docx,.txt,.jpg,.jpeg,.png,.gif,.zip,.rar'
                            }
                            className="hidden"
                            disabled={uploadingFile}
                          />
                        </label>
                        <p className="text-sm text-gray-500 mt-2">
                          {materialType === 'pdf' && 'Upload PDF files (Max 10MB)'}
                          {materialType === 'module' && 'Upload ZIP/RAR archive with course modules (Max 10MB)'}
                          {materialType === 'file' && 'Supported: PDF, DOC, DOCX, TXT, Images, ZIP (Max 10MB)'}
                        </p>
                      </div>
                    )}

                    {/* Video Link Form */}
                    {materialType === 'video' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                          <input
                            type="text"
                            name="title"
                            value={materialForm.title}
                            onChange={handleMaterialFormChange}
                            placeholder="e.g., Introduction Video"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Video URL (YouTube, Vimeo, etc.)</label>
                          <input
                            type="url"
                            name="videoUrl"
                            value={materialForm.videoUrl}
                            onChange={handleMaterialFormChange}
                            placeholder="https://youtube.com/watch?v=..."
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            name="description"
                            value={materialForm.description}
                            onChange={handleMaterialFormChange}
                            rows={2}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddMaterial(selectedCourse!._id)}
                            className="px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800"
                          >
                            Add Video
                          </button>
                          <button
                            onClick={() => {
                              setShowAddMaterialForm(false);
                              setMaterialForm({ title: '', description: '', videoUrl: '', externalUrl: '', noteContent: '' });
                            }}
                            className="px-4 py-2 bg-neutral-200 text-black rounded-md hover:bg-neutral-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* External Link Form */}
                    {materialType === 'link' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                          <input
                            type="text"
                            name="title"
                            value={materialForm.title}
                            onChange={handleMaterialFormChange}
                            placeholder="e.g., Official Documentation"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                          <input
                            type="url"
                            name="externalUrl"
                            value={materialForm.externalUrl}
                            onChange={handleMaterialFormChange}
                            placeholder="https://..."
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <textarea
                            name="description"
                            value={materialForm.description}
                            onChange={handleMaterialFormChange}
                            rows={2}
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddMaterial(selectedCourse!._id)}
                            className="px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800"
                          >
                            Add Link
                          </button>
                          <button
                            onClick={() => {
                              setShowAddMaterialForm(false);
                              setMaterialForm({ title: '', description: '', videoUrl: '', externalUrl: '', noteContent: '' });
                            }}
                            className="px-4 py-2 bg-neutral-200 text-black rounded-md hover:bg-neutral-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Note Form */}
                    {materialType === 'note' && (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
                          <input
                            type="text"
                            name="title"
                            value={materialForm.title}
                            onChange={handleMaterialFormChange}
                            placeholder="e.g., Important Concepts"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Note Content</label>
                          <textarea
                            name="noteContent"
                            value={materialForm.noteContent}
                            onChange={handleMaterialFormChange}
                            rows={6}
                            placeholder="Write your notes here..."
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                          <input
                            type="text"
                            name="description"
                            value={materialForm.description}
                            onChange={handleMaterialFormChange}
                            placeholder="Brief description"
                            className="w-full px-3 py-2 border border-neutral-300 rounded-md"
                          />
                        </div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleAddMaterial(selectedCourse!._id)}
                            className="px-4 py-2 bg-black text-white rounded-md hover:bg-neutral-800"
                          >
                            Add Note
                          </button>
                          <button
                            onClick={() => {
                              setShowAddMaterialForm(false);
                              setMaterialForm({ title: '', description: '', videoUrl: '', externalUrl: '', noteContent: '' });
                            }}
                            className="px-4 py-2 bg-neutral-200 text-black rounded-md hover:bg-neutral-300"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Materials List */}
              {selectedCourse.materials && selectedCourse.materials.length > 0 ? (
                <div className="space-y-3">
                  {selectedCourse.materials.map((material) => (
                    <div key={material._id} className="border border-neutral-200 rounded-lg p-4 flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <div className="w-10 h-10 bg-neutral-100 rounded flex items-center justify-center text-xl">
                          {material.materialType === 'file' && '📄'}
                          {material.materialType === 'video' && '🎥'}
                          {material.materialType === 'link' && '🔗'}
                          {material.materialType === 'note' && '📝'}
                          {!material.materialType && (
                            <>
                              {material.fileType === 'pdf' && <span className="text-red-600 font-bold text-xs">PDF</span>}
                              {material.fileType === 'document' && <span className="text-blue-600 font-bold text-xs">DOC</span>}
                              {material.fileType === 'image' && <span className="text-green-600 font-bold text-xs">IMG</span>}
                              {material.fileType === 'other' && <span className="text-gray-600 font-bold text-xs">FILE</span>}
                            </>
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <h4 className="font-medium text-black">{material.title}</h4>
                            {material.materialType && (
                              <span className="text-xs bg-neutral-200 px-2 py-0.5 rounded uppercase">
                                {material.materialType}
                              </span>
                            )}
                          </div>
                          {material.description && (
                            <p className="text-sm text-gray-600 mb-2">{material.description}</p>
                          )}

                          {/* Video Link */}
                          {material.materialType === 'video' && material.videoUrl && (
                            <a 
                              href={material.videoUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all"
                            >
                              {material.videoUrl}
                            </a>
                          )}

                          {/* External Link */}
                          {material.materialType === 'link' && material.externalUrl && (
                            <a 
                              href={material.externalUrl} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              className="text-sm text-blue-600 hover:underline break-all"
                            >
                              {material.externalUrl}
                            </a>
                          )}

                          {/* Note Content */}
                          {material.materialType === 'note' && material.noteContent && (
                            <div className="mt-2 p-3 bg-yellow-50 rounded border border-yellow-200 max-h-40 overflow-y-auto">
                              <p className="text-sm text-gray-700 whitespace-pre-wrap">{material.noteContent}</p>
                            </div>
                          )}

                          <p className="text-xs text-gray-400 mt-2">
                            {material.uploadedAt ? `Uploaded: ${new Date(material.uploadedAt).toLocaleDateString()}` : 
                             material.createdAt ? `Added: ${new Date(material.createdAt).toLocaleDateString()}` : ''}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 ml-4">
                        {material.materialType === 'file' && material.fileUrl && (
                          <a
                            href={material.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            View
                          </a>
                        )}
                        {material.materialType === 'video' && material.videoUrl && (
                          <a
                            href={material.videoUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Watch
                          </a>
                        )}
                        {material.materialType === 'link' && material.externalUrl && (
                          <a
                            href={material.externalUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            Open
                          </a>
                        )}
                        {!material.materialType && material.fileUrl && (
                          <a
                            href={material.fileUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                          >
                            View
                          </a>
                        )}
                        <button
                          onClick={() => handleDeleteMaterial(selectedCourse._id, material._id)}
                          className="px-3 py-1 bg-red-600 text-white rounded text-sm hover:bg-red-700"
                        >
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500">
                  No materials uploaded yet
                </div>
              )}
            </div>

            <div className="px-6 py-4 border-t border-neutral-200">
              <button
                onClick={closeMaterialsModal}
                className="px-6 py-2 bg-neutral-200 text-black rounded-md hover:bg-neutral-300"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCoursesPage;
