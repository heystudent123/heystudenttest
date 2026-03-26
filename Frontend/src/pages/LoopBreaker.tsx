import React, { useState, useEffect, useRef } from 'react';

/**
 * This component demonstrates the correct way to handle useEffect to avoid infinite update loops.
 * It shows common patterns that cause the "Maximum update depth exceeded" error and how to fix them.
 */
const LoopBreaker: React.FC = () => {
  // Create state variables
  const [count, setCount] = useState(0);
  const [data, setData] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // useRef to track if component is mounted - critical for async operations
  const isMounted = useRef(true);
  
  // PROBLEM EXAMPLE 1: Missing dependency array causes infinite updates
  // This will run on EVERY render and cause an infinite loop:
  /*
  useEffect(() => {
    // This updates state, causing a re-render, which runs this effect again...
    setCount(count + 1);
  }); // No dependency array!
  */
  
  // PROBLEM EXAMPLE 2: Incorrect dependency that changes every render
  /*
  useEffect(() => {
    // This function is recreated on every render
    const fetchData = () => {
      setData(['some', 'data']);
    };
    
    fetchData();
  }, [fetchData]); // fetchData is recreated every render!
  */
  
  // PROBLEM EXAMPLE 3: Object/array dependencies that are recreated each render
  /*
  const options = { sort: true, filter: 'all' };
  
  useEffect(() => {
    // Do something with options
    setIsLoading(false);
  }, [options]); // options is a new object reference each render!
  */
  
  // SOLUTION 1: Empty dependency array for one-time effects
  useEffect(() => {
    // Proper cleanup to prevent memory leaks and updates after unmount
    return () => {
      isMounted.current = false;
    };
  }, []); // Empty array = run once on mount
  
  // SOLUTION 2: Proper dependency tracking
  useEffect(() => {
    // Only runs when count changes
    document.title = `Count: ${count}`;
  }, [count]); // Only depend on primitives or stable references
  
  // SOLUTION 3: useRef for values that shouldn't trigger re-renders
  const prevCount = useRef(count);
  useEffect(() => {
    // Track previous value without causing re-renders
    prevCount.current = count;
  }, [count]);
  
  // SOLUTION 4: Async operations with proper cleanup
  useEffect(() => {
    let isCancelled = false;
    
    const fetchData = async () => {
      setIsLoading(true);
      
      try {
        // Simulate API call
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // Only update state if component is still mounted
        if (!isCancelled && isMounted.current) {
          setData(['item1', 'item2', 'item3']);
          setIsLoading(false);
        }
      } catch (error) {
        if (!isCancelled && isMounted.current) {
          console.error('Error fetching data:', error);
          setIsLoading(false);
        }
      }
    };
    
    fetchData();
    
    // Cleanup function to prevent state updates after unmount
    return () => {
      isCancelled = true;
    };
  }, []); // Run once on mount
  
  return (
    <div className="p-6 max-w-md mx-auto bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-bold mb-4">Loop Breaker Demo</h1>
      <p className="mb-4">
        This component demonstrates how to fix infinite update loops in React components.
      </p>
      
      <div className="mb-4">
        <h2 className="text-lg font-semibold mb-2">Current count: {count}</h2>
        <button
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
          onClick={() => setCount(count + 1)}
        >
          Increment
        </button>
      </div>
      
      <div>
        <h2 className="text-lg font-semibold mb-2">Data:</h2>
        {isLoading ? (
          <p>Loading...</p>
        ) : (
          <ul className="list-disc pl-5">
            {data.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        )}
      </div>
      
      <div className="mt-6 p-4 bg-yellow-50 border border-yellow-100 rounded">
        <h3 className="text-md font-semibold mb-2">Common causes of infinite loops:</h3>
        <ol className="list-decimal pl-5">
          <li>Missing dependency array in useEffect</li>
          <li>State updates inside useEffect without proper dependencies</li>
          <li>Object/array dependencies that are recreated each render</li>
          <li>Function dependencies without useCallback</li>
          <li>Missing cleanup for asynchronous operations</li>
        </ol>
      </div>
    </div>
  );
};

export default LoopBreaker;
