import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/api';

interface Institute {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  college?: string;
  referralCode: string;
  referralCount: number;
  createdAt: string;
}

interface Student {
  _id: string;
  name: string;
  phone: string;
  email?: string;
  college?: string;
  collegeYear?: string;
  createdAt: string;
}

const AdminInstitutesPage: React.FC = () => {
  const [institutes, setInstitutes] = useState<Institute[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedInstitute, setSelectedInstitute] = useState<Institute | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    // Function to fetch institutes with referral stats
    const fetchInstitutes = async () => {
      try {
        const response = await authApi.getInstitutes();
        setInstitutes(response.data);
        setLoading(false);
      } catch (err: any) {
        console.error('Error fetching institutes:', err);
        setError(err.response?.data?.message || 'Failed to fetch institutes');
        setLoading(false);
      }
    };

    fetchInstitutes();
  }, []);
  
  // Function to fetch students by referral code
  const fetchStudentsByReferralCode = async (institute: Institute) => {
    setSelectedInstitute(institute);
    setLoadingStudents(true);
    setShowModal(true);
    
    try {
      const response = await authApi.getUsersByReferralCode(institute.referralCode);
      setStudents(response.data);
      setLoadingStudents(false);
    } catch (err: any) {
      console.error('Error fetching students:', err);
      setStudents([]);
      setLoadingStudents(false);
    }
  };
  
  // Function to close the modal
  const closeModal = () => {
    setShowModal(false);
    setSelectedInstitute(null);
    setStudents([]);
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
      <div className="max-w-7xl mx-auto">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 gap-4">
          <h1 className="text-3xl font-bold text-gray-900">Institute Management</h1>
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              to="/admin/users"
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-black hover:bg-gray-800"
            >
              Add an Institute
            </Link>
            <Link
              to="/admin"
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 bg-red-50 border-l-4 border-red-400 p-4">
            <p className="text-red-700">{error}</p>
          </div>
        )}

        <div className="bg-white shadow overflow-hidden sm:rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h2 className="text-lg leading-6 font-medium text-gray-900">Institutes</h2>
            <p className="mt-1 max-w-2xl text-sm text-gray-500">
              View institutes and their referral statistics.
            </p>
          </div>
          
          <div className="border-t border-gray-200">
            {/* Desktop view - Table */}
            <div className="hidden md:block">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Name
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Phone
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      College
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referral Code
                    </th>
                    <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Referrals Count
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {institutes.length > 0 ? (
                    institutes.map((institute) => (
                      <tr key={institute._id} 
                          className="cursor-pointer hover:bg-gray-50"
                          onClick={() => fetchStudentsByReferralCode(institute)}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="text-sm font-medium text-gray-900">{institute.name}</div>
                          {institute.email && (
                            <div className="text-sm text-gray-500">{institute.email}</div>
                          )}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {institute.phone}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                          {institute.college || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {institute.referralCode}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {institute.referralCount}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                        No institutes found. Promote users to institute role from the User Management page.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            
            {/* Mobile view - Cards */}
            <div className="md:hidden">
              {institutes.length > 0 ? (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {institutes.map((institute) => (
                    <div 
                      key={institute._id} 
                      className="bg-white p-4 rounded-lg shadow cursor-pointer hover:bg-gray-50"
                      onClick={() => fetchStudentsByReferralCode(institute)}
                    >
                      <div className="flex flex-col space-y-3">
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Name</h3>
                          <p className="text-sm text-gray-700">{institute.name}</p>
                          {institute.email && <p className="text-xs text-gray-500">{institute.email}</p>}
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Phone</h3>
                          <p className="text-sm text-gray-700">{institute.phone}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">College</h3>
                          <p className="text-sm text-gray-700">{institute.college || '-'}</p>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Referral Code</h3>
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                            {institute.referralCode}
                          </span>
                        </div>
                        
                        <div>
                          <h3 className="text-sm font-medium text-gray-900">Referrals Count</h3>
                          <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-green-100 text-green-800">
                            {institute.referralCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-4 text-sm text-gray-500">
                  No institutes found. Promote users to institute role from the User Management page.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Modal for displaying students */}
      {showModal && (
        <div className="fixed inset-0 bg-gray-600 bg-opacity-50 overflow-y-auto h-full w-full z-50 flex items-center justify-center">
          <div className="relative bg-white rounded-lg shadow-xl max-w-4xl w-full mx-4 max-h-[90vh] overflow-hidden flex flex-col">
            {/* Modal header */}
            <div className="px-6 py-4 border-b border-gray-200 flex justify-between items-center sticky top-0 bg-white z-10">
              <h3 className="text-lg font-medium text-gray-900">
                Students for {selectedInstitute?.name} ({selectedInstitute?.referralCode})
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-500 focus:outline-none"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* Modal body */}
            <div className="flex-1 overflow-y-auto p-6">
              {loadingStudents ? (
                <div className="flex justify-center items-center h-40">
                  <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-primary"></div>
                </div>
              ) : students.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Name
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Phone
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Email
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          College
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Year
                        </th>
                        <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Joined
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {students.map((student) => (
                        <tr key={student._id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="text-sm font-medium text-gray-900">{student.name}</div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.phone}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.email || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.college || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {student.collegeYear || '-'}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {new Date(student.createdAt).toLocaleDateString()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <div className="text-center py-10">
                  <svg
                    className="mx-auto h-12 w-12 text-gray-400"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 13h6m-3-3v6m-9 1V7a2 2 0 012-2h6l2 2h6a2 2 0 012 2v8a2 2 0 01-2 2H5a2 2 0 01-2-2z"
                    />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-gray-900">No students found</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    No students have signed up using this institute's referral code yet.
                  </p>
                </div>
              )}
            </div>
            
            {/* Modal footer */}
            <div className="px-6 py-4 border-t border-gray-200 flex justify-end sticky bottom-0 bg-white">
              <button
                onClick={closeModal}
                className="px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500"
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

export default AdminInstitutesPage;
