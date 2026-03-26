import React, { useState, useEffect } from 'react';
import axios from 'axios';
import SharedNavbar from '../components/SharedNavbar';

// Get the base URL for the ping endpoint
// The ping endpoint is at the root level, not under /api
const API_URL = process.env.REACT_APP_API_URL || '';
// Use URL parsing to safely handle path segments
const baseUrl = new URL(API_URL);
const BASE_URL = baseUrl.origin; // This preserves the protocol, host, and port without path

const PingPage: React.FC = () => {
  const [lastPingTime, setLastPingTime] = useState<string | null>(null);
  const [nextPingTime, setNextPingTime] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState<number>(300); // 5 minutes in seconds
  const [pingHistory, setPingHistory] = useState<Array<{ time: string, success: boolean, message?: string }>>([]);
  const [pingStatus, setPingStatus] = useState<'idle' | 'success' | 'error'>('idle');

  // Function to send ping request
  const sendPing = async () => {
    try {
      setPingStatus('idle');
      const response = await axios.get(`${BASE_URL}/ping`);
      
      // Update ping history
      setPingHistory(prev => [
        { 
          time: new Date().toLocaleTimeString(), 
          success: true, 
          message: response.data.message 
        },
        ...prev.slice(0, 9) // Keep only the last 10 pings
      ]);
      
      // Update last ping time
      const currentTime = new Date();
      setLastPingTime(currentTime.toLocaleTimeString());
      
      // Set next ping time (5 minutes from now)
      const nextTime = new Date(currentTime.getTime() + 5 * 60 * 1000);
      setNextPingTime(nextTime);
      
      // Reset countdown
      setCountdown(300);
      setPingStatus('success');
    } catch (error) {
      console.error('Ping failed:', error);
      setPingHistory(prev => [
        { 
          time: new Date().toLocaleTimeString(), 
          success: false, 
          message: 'Failed to connect to server' 
        },
        ...prev.slice(0, 9)
      ]);
      setPingStatus('error');
    }
  };

  // Send ping on component mount and every 5 minutes
  useEffect(() => {
    // Send initial ping
    sendPing();
    
    // Set up interval for pings every 5 minutes
    const pingInterval = setInterval(() => {
      sendPing();
    }, 5 * 60 * 1000);
    
    // Clean up interval on component unmount
    return () => clearInterval(pingInterval);
  }, []);

  // Update countdown timer every second
  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          return 300; // Reset to 5 minutes when it reaches zero
        }
        return prev - 1;
      });
    }, 1000);
    
    return () => clearInterval(timer);
  }, []);

  // Format countdown as MM:SS
  const formatCountdown = () => {
    const minutes = Math.floor(countdown / 60);
    const seconds = countdown % 60;
    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
  };

  // Handle manual ping
  const handleManualPing = () => {
    sendPing();
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <SharedNavbar />
      <div className="container mx-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          <h1 className="text-3xl font-bold text-gray-900 mb-6">Server Ping Monitor</h1>
          
          <div className="bg-white shadow-md rounded-lg overflow-hidden mb-6">
            <div className="p-6">
              <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
                <div>
                  <h2 className="text-xl font-semibold text-gray-800 mb-1">Ping Status</h2>
                  <p className="text-gray-600">
                    Automatically pinging server every 5 minutes
                  </p>
                </div>
                
                <div className="mt-4 md:mt-0">
                  <button 
                    onClick={handleManualPing}
                    className="bg-blue-600 hover:bg-blue-700 text-white py-2 px-6 rounded-lg flex items-center"
                  >
                    <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                    </svg>
                    Ping Now
                  </button>
                </div>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className={`p-4 rounded-lg ${
                  pingStatus === 'success' ? 'bg-green-50' : 
                  pingStatus === 'error' ? 'bg-red-50' : 'bg-gray-50'
                }`}>
                  <p className="text-sm text-gray-500">Status</p>
                  <p className={`text-xl font-semibold ${
                    pingStatus === 'success' ? 'text-green-600' : 
                    pingStatus === 'error' ? 'text-red-600' : 'text-gray-600'
                  }`}>
                    {pingStatus === 'success' ? 'Connected' : 
                     pingStatus === 'error' ? 'Failed' : 'Checking...'}
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-blue-50">
                  <p className="text-sm text-gray-500">Last Ping</p>
                  <p className="text-xl font-semibold text-blue-600">
                    {lastPingTime || 'N/A'}
                  </p>
                </div>
                
                <div className="p-4 rounded-lg bg-purple-50">
                  <p className="text-sm text-gray-500">Next Ping In</p>
                  <p className="text-xl font-semibold text-purple-600">
                    {formatCountdown()}
                  </p>
                </div>
              </div>
            </div>
          </div>
          
          <div className="bg-white shadow-md rounded-lg overflow-hidden">
            <div className="p-6">
              <h2 className="text-xl font-semibold text-gray-800 mb-4">Ping History</h2>
              
              {pingHistory.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Time
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Message
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {pingHistory.map((ping, index) => (
                        <tr key={index}>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                            {ping.time}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                              ping.success 
                                ? 'bg-green-100 text-green-800' 
                                : 'bg-red-100 text-red-800'
                            }`}>
                              {ping.success ? 'Success' : 'Failed'}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                            {ping.message || 'No message'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-center py-4">No ping history yet</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PingPage;
