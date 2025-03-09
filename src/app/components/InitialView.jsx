// File: src/components/SimulatorPage.jsx
'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useSpring, animated } from 'react-spring';
import ForceGraph2D from 'react-force-graph-2d';
import { toast } from 'react-toastify';
import { MOCK_PERSONA_DATA } from './mockData';
import { generateEnhancedGraph } from './graphGenerator';
import { X } from 'lucide-react';

// Define color mapping for persona groups (keeping the same colors)
const SEGMENT_COLORS = {
  "Group A": "#FF5733", // Vibrant Red
  "Group B": "#33FF57", // Bright Green
  "Group C": "#3357FF", // Vivid Blue
  "Group D": "#F1C40F"  // Sunny Yellow
};

const SEGMENT_LABELS = [
  { id: "all", name: "All personas" },
  { id: "group-a", name: "Group A", color: SEGMENT_COLORS["Group A"] },
  { id: "group-b", name: "Group B", color: SEGMENT_COLORS["Group B"] },
  { id: "group-c", name: "Group C", color: SEGMENT_COLORS["Group C"] },
  { id: "group-d", name: "Group D", color: SEGMENT_COLORS["Group D"] }
];

const InitialView = () => {
  const [productDescription, setProductDescription] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [credits, setCredits] = useState(8);
  const [openrouterKey, setOpenrouterKey] = useState('');
  const [activeSegments, setActiveSegments] = useState(['all']);
  const [personas, setPersonas] = useState([]);
  const [testingMessage, setTestingMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [blinkingNodes, setBlinkingNodes] = useState(new Set());
  const [highlightedNodeId, setHighlightedNodeId] = useState(null);
  const [selectedPersona, setSelectedPersona] = useState(null);
  const [showDetailModal, setShowDetailModal] = useState(false);
  const graphRef = useRef();
  const nodesFixedRef = useRef(false);

  // Animation for the input panel
  const [inputPanelOpen, setInputPanelOpen] = useState(true);
  const inputPanelAnimation = useSpring({
    transform: inputPanelOpen ? 'translateY(0%)' : 'translateY(100%)',
    opacity: inputPanelOpen ? 1 : 0,
  });

  // Helper function to convert hex colors to RGBA
  const hexToRGBA = (hex, alpha) => {
    let r, g, b;
    if(hex.startsWith('#')) hex = hex.slice(1);
    if(hex.length === 3) {
      r = parseInt(hex[0] + hex[0], 16);
      g = parseInt(hex[1] + hex[1], 16);
      b = parseInt(hex[2] + hex[2], 16);
    } else if(hex.length === 6) {
      r = parseInt(hex.slice(0,2), 16);
      g = parseInt(hex.slice(2,4), 16);
      b = parseInt(hex.slice(4,6), 16);
    }
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  };

  // Generate graph on mount
  useEffect(() => {
    generatePersonas();
  }, []);

  // Generate graph when personas or active segments change
  useEffect(() => {
    if (personas.length > 0) {
      generateGraph();
      nodesFixedRef.current = false; // Reset the fixed flag when generating a new graph
    }
  }, [personas, activeSegments]);

  // Effect to fix node positions after initial layout
  useEffect(() => {
    if (graphRef.current && graphData.nodes.length > 0 && !nodesFixedRef.current) {
      const fixNodesTimeout = setTimeout(() => {
        // Fix all node positions
        if (graphRef.current && graphData.nodes.length > 0) {
          // Stop the physics simulation
          const fg = graphRef.current;
          if (fg) {
            try {
              // Stop the simulation if possible
              const simulation = fg.d3Force();
              if (simulation && simulation.stop) {
                simulation.stop();
              }
              
              // Fix the position of all nodes
              graphData.nodes.forEach(node => {
                // Set fixed position coordinates to current position
                node.fx = node.x || 0;
                node.fy = node.y || 0;
                
                // Store original color for highlighting
                node._color = node.color;
              });
              
              nodesFixedRef.current = true;
            } catch (error) {
              console.error("Error fixing node positions:", error);
            }
          }
        }
      }, 2000); // Wait 2 seconds for initial layout
      
      return () => clearTimeout(fixNodesTimeout);
    }
  }, [graphData.nodes]);

  // Background animation effect during testing:
  // Progressively make more nodes colorful during testing to simulate 
  // propagation of responses throughout the network
  useEffect(() => {
    if (isTesting) {
      // Initial testing state: all nodes are gray except for a few blinking ones
      // As time progresses, more nodes become colorful
      
      // Track the active colored nodes (starts empty, grows over time)
      const activeNodeIds = new Set();
      
      // Timer to periodically update the active and blinking node sets
      const interval = setInterval(() => {
        const nodeCount = graphData.nodes.length;
        
        // Phase 1: Start with just a few bright nodes
        if (activeNodeIds.size < nodeCount * 0.1) {
          // Add some random nodes to the active set (about 2-5 per update)
          const newActivationCount = Math.floor(Math.random() * 4) + 2;
          
          for (let i = 0; i < newActivationCount; i++) {
            const randomNodeIndex = Math.floor(Math.random() * nodeCount);
            if (randomNodeIndex < nodeCount && graphData.nodes[randomNodeIndex]) {
              activeNodeIds.add(graphData.nodes[randomNodeIndex].id);
            }
          }
        } 
        // Phase 2: Middle of simulation, activate nodes connected to already active ones
        else if (activeNodeIds.size < nodeCount * 0.5) {
          // Find nodes connected to active nodes and activate them
          const connectedNodeIds = new Set();
          
          graphData.links.forEach(link => {
            const sourceId = typeof link.source === 'object' ? link.source.id : link.source;
            const targetId = typeof link.target === 'object' ? link.target.id : link.target;
            
            // If one end is active but the other isn't, consider activating the inactive end
            if (activeNodeIds.has(sourceId) && !activeNodeIds.has(targetId) && Math.random() < 0.3) {
              connectedNodeIds.add(targetId);
            } else if (activeNodeIds.has(targetId) && !activeNodeIds.has(sourceId) && Math.random() < 0.3) {
              connectedNodeIds.add(sourceId);
            }
          });
          
          // Add the connected nodes to the active set
          connectedNodeIds.forEach(id => activeNodeIds.add(id));
          
          // Also add some random nodes (1-3 per update)
          const randomActivationCount = Math.floor(Math.random() * 3) + 1;
          for (let i = 0; i < randomActivationCount; i++) {
            const randomNodeIndex = Math.floor(Math.random() * nodeCount);
            if (randomNodeIndex < nodeCount && graphData.nodes[randomNodeIndex]) {
              activeNodeIds.add(graphData.nodes[randomNodeIndex].id);
            }
          }
        }
        // Phase 3: End of simulation, activate most remaining nodes
        else {
          // Activate almost all remaining nodes quickly
          graphData.nodes.forEach(node => {
            if (!activeNodeIds.has(node.id) && Math.random() < 0.4) {
              activeNodeIds.add(node.id);
            }
          });
        }
        
        // Determine blinking nodes (subset of active nodes + some inactive ones)
        const newBlinkingNodes = new Set();
        
        // Add some active nodes to blinking set
        activeNodeIds.forEach(id => {
          if (Math.random() < 0.2) { // 20% chance for an active node to blink
            newBlinkingNodes.add(id);
          }
        });
        
        // Add some inactive nodes to blinking set
        const inactiveBlinkCount = Math.min(20, nodeCount - activeNodeIds.size);
        let attempts = 0;
        while (newBlinkingNodes.size < 20 && attempts < 40) {
          attempts++;
          const randomNodeIndex = Math.floor(Math.random() * nodeCount);
          if (randomNodeIndex < nodeCount && graphData.nodes[randomNodeIndex]) {
            const nodeId = graphData.nodes[randomNodeIndex].id;
            if (!activeNodeIds.has(nodeId)) {
              newBlinkingNodes.add(nodeId);
            }
          }
        }
        
        setBlinkingNodes(newBlinkingNodes);
      }, 500);
      
      return () => clearInterval(interval);
    } else {
      setBlinkingNodes(new Set());
    }
  }, [isTesting, graphData.nodes, graphData.links]);

  // Function to generate personas with different groups
  const generatePersonas = () => {
    // Use generic groups instead of regional segments
    const segments = ["Group A", "Group B", "Group C", "Group D"];
    const generatedPersonas = [];
    
    // Diverse first names for personalized nodes
    const firstNames = [
      "Alex", "Jamie", "Jordan", "Taylor", "Morgan", "Casey", "Riley", "Avery", "Quinn", "Dakota",
      "Cameron", "Reese", "Finley", "Emerson", "Rowan", "Sage", "Blake", "Parker", "Charlie", "Hayden",
      "Skyler", "Phoenix", "Robin", "Kendall", "Kai", "River", "Remy", "Jesse", "Ash", "Drew",
      "Leslie", "Dana", "Logan", "Shawn", "Kerry", "Terry", "Sidney", "Jody", "Pat", "Tracy"
    ];
    
    // Last names for personalized nodes
    const lastNames = [
      "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
      "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
      "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson",
      "Walker", "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
    ];

    // Create 400 personas to reduce clutter while still having plenty
    for (let i = 0; i < 400; i++) {
      // Select a random mock persona to base attributes on
      const baseMockPersona = MOCK_PERSONA_DATA[Math.floor(Math.random() * MOCK_PERSONA_DATA.length)];
      
      // Balance segments evenly with ~100 per group
      const segmentIndex = Math.floor(i / 100) % 4;
      const segment = segments[segmentIndex];
      
      // Generate a unique name for this persona
      const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
      const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
      const fullName = `${firstName} ${lastName}`;
      
      // Vary size by group for better visual distinction
      let baseSize;
      switch(segmentIndex) {
        case 0: baseSize = 1.2; break; // Group A
        case 1: baseSize = 1.0; break; // Group B
        case 2: baseSize = 1.4; break; // Group C
        case 3: baseSize = 1.6; break; // Group D
        default: baseSize = 1.2;
      }
      
      // Small random variation (+/- 20%)
      const uniqueSize = baseSize * (0.8 + Math.random() * 0.4);
      
      // Fewer square nodes for visual cohesion (10% squares)
      const uniqueShape = Math.random() > 0.9 ? "square" : "circle";
      
      // Patterns: 60% of nodes have no pattern for a clean look
      const uniquePatternId = Math.random() > 0.4 ? 0 : Math.floor(Math.random() * 5);
      
      generatedPersonas.push({
        id: `persona-${i}`,
        name: fullName,
        displayId: `ID-${Math.floor(1000 + Math.random() * 9000)}`, // 4-digit ID
        segment,
        attributes: { ...baseMockPersona },
        size: uniqueSize,
        shape: uniqueShape,
        patternId: uniquePatternId,
        pulseRate: Math.random() * 0.7 + 0.3, // Random pulse rate for animations
      });
    }
    setPersonas(generatedPersonas);
  };

  // Function to generate network graph based on active segments
  const generateGraph = () => {
    // Use the enhanced graph generator function that ensures full connectivity
    const { nodes, links } = generateEnhancedGraph(personas, activeSegments, SEGMENT_COLORS);
    setGraphData({ nodes, links });
  };

  // Toggle group visibility
  const toggleSegment = (segmentId) => {
    setActiveSegments(prev => {
      if (segmentId === 'all') {
        return ['all'];
      } else if (prev.includes(segmentId)) {
        const newSegments = prev.filter(id => id !== segmentId);
        return newSegments.length === 0 ? ['all'] : newSegments;
      } else {
        const newSegments = [...prev.filter(id => id !== 'all'), segmentId];
        return newSegments;
      }
    });
  };

  // No longer needed as we're using backend API

  // Run simulation using the backend API
  const runSimulation = async () => {
    if (!productDescription.trim()) {
      toast.error("Please describe your product or service first!");
      return;
    }
    
    if (credits <= 0) {
      toast.error("You've used all your credits. Please upgrade for more simulations.");
      return;
    }
    
    setIsTesting(true);
    setTestingMessage(`Simulating network responses across different regions of India. This will take a moment...`);
    setInputPanelOpen(false);
    
    try {
      // Simulate initial network delay
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      setTestingMessage("Analyzing responses and generating persona insights...");
      
      // Make API call to your backend
      const response = await fetch("http://localhost:8000/api/v1/simulate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          prompt: productDescription
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Backend API error: ${response.status} ${errorData.error || ""}`);
      }
      
      const data = await response.json();
      
      // Process the backend API response
      if (!data.results || !Array.isArray(data.results) || data.results.length === 0) {
        throw new Error("Invalid response format from backend");
      }
      
      // Transform the backend response into our application format
      const personaResults = data.results[0].persona_results || [];
      
      // Ensure we have enough personas to distribute - if not enough, duplicate some
      const paddedResults = [...personaResults];
      while (paddedResults.length < 4) {
        // Duplicate existing responses if we have fewer than 4
        const sourceIndex = paddedResults.length % personaResults.length;
        if (personaResults[sourceIndex]) {
          paddedResults.push({...personaResults[sourceIndex]});
        } else {
          // If somehow we have no valid personas at all, create a dummy one
          paddedResults.push({
            thought: "No analysis available.",
            decision: "Unable to determine.",
            score: 5,
            persona_excerpt: "No persona information available."
          });
        }
      }
      
      // Group results by regions (North, South, East, West India)
      const regions = ["North India", "South India", "East India", "West India"];
      const results = regions.map((region, index) => {
        // Determine sentiment from scores (either use the actual data or generate fallbacks)
        const personaData = paddedResults[index] || {
          thought: "No analysis available for this region.",
          decision: "Unable to provide insights for this region.",
          score: Math.floor(Math.random() * 5) + 5, // Random score between 5-10
          persona_excerpt: "No persona information available."
        };
        
        // Convert 0-10 score to 0-100
        const sentimentScore = Math.min(100, Math.floor((personaData.score || 5) * 10));
        
        // Thoughts and decisions from persona data
        const thoughts = personaData.thought || "No detailed analysis available for this region.";
        const decision = personaData.decision || "No opinion available.";
        
        // Generate smart action items based on the sentiment score
        let actionItems = [];
        
        if (sentimentScore >= 75) {
          actionItems = [
            `Leverage ${region}'s positive reception in marketing campaigns.`,
            `Consider ${region} as an early launch market for this product.`
          ];
        } else if (sentimentScore >= 50) {
          actionItems = [
            `Address ${region}'s specific concerns before full rollout.`,
            `Adapt marketing messaging to highlight value proposition for ${region}.`
          ];
        } else {
          actionItems = [
            `Reconsider product features to better align with ${region}'s needs.`,
            `Conduct additional market research in ${region} before launch.`
          ];
        }
        
        return {
          region,
          sentimentScore,
          attentionScore: Math.min(100, Math.floor(sentimentScore * (0.8 + Math.random() * 0.4))), // Varied attention score
          thoughts,
          opinion: decision,
          actionItems,
          personaExcerpt: personaData.persona_excerpt || "No persona information available.",
          rawScore: personaData.score || 0,
          insights: `Region: ${region}\n\n` +
                   `Thoughts:\n${thoughts}\n\n` +
                   `Opinion:\n${decision}\n\n` +
                   `Action Items:\n` + 
                   actionItems.map(item => `• ${item}`).join('\n'),
          timestamp: new Date().toISOString(),
          // Store all raw persona data for this region for detailed view
          personas: [personaData]
        };
      });
      
      setSimulationResults(results);
      setShowResults(true);
      setCredits(prev => prev - 1);
      
    } catch (error) {
      console.error("Simulation error:", error);
      toast.error(`Simulation failed: ${error.message}`);
      setIsTesting(false);
      setInputPanelOpen(true);
    } finally {
      setIsTesting(false);
    }
  };

  // Reset simulation to start new one
  const resetSimulation = () => {
    setShowResults(false);
    setInputPanelOpen(true);
    setSimulationResults(null);
    setProductDescription('');
  };

  return (
    <div className="flex flex-col h-screen bg-black text-white overflow-hidden">
      {/* Main graph area */}
      <div className="flex-1 relative">
        {/* Segment filters */}
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-10 flex space-x-2">
          {SEGMENT_LABELS.map(segment => (
            <button
              key={segment.id}
              className={`px-3 py-1 rounded-full text-sm flex items-center ${
                activeSegments.includes(segment.id) 
                  ? 'bg-gray-800 text-white' 
                  : 'bg-gray-900 text-gray-400'
              }`}
              onClick={() => toggleSegment(segment.id)}
            >
              {segment.id !== 'all' && (
                <span 
                  className="w-3 h-3 rounded-full mr-2" 
                  style={{ backgroundColor: segment.color }}
                ></span>
              )}
              {segment.name}
              <svg className="w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </button>
          ))}
        </div>
        
        {/* Results Cards Panel with Glassmorphism Effect */}
        {showResults && simulationResults && (
          <div className="absolute top-16 right-4 w-96 z-10 space-y-4 overflow-y-auto" style={{ maxHeight: '80vh' }}>
            {simulationResults.map((result, index) => {
              // Get region color or use default
              const regionColor = SEGMENT_COLORS[result.region] || "#6366F1";
              
              return (
                <div 
                  key={index} 
                  className="relative overflow-hidden rounded-xl cursor-pointer transition-all duration-300 hover:scale-[1.02]"
                  onClick={() => {
                    setSelectedPersona(result);
                    setShowDetailModal(true);
                  }}
                >
                  {/* Glassmorphism card */}
                  <div className="backdrop-blur-md bg-black/40 border border-white/10 p-4 rounded-xl">
                    {/* Glass highlight effect */}
                    <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                    
                    {/* Region header with color accent */}
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex items-center">
                        <div 
                          className="w-3 h-12 rounded-sm mr-3" 
                          style={{ backgroundColor: regionColor }}
                        ></div>
                        <div>
                          <div className="text-lg font-semibold text-white">{result.region}</div>
                          <div className="text-xs text-gray-400">Score: {result.rawScore}/10</div>
                        </div>
                      </div>
                      <div className="rounded-md text-2xl font-bold text-white flex items-center">
                        {result.sentimentScore}
                        <span className="text-xs ml-1 text-gray-400">/ 100</span>
                      </div>
                    </div>
                    
                    {/* Bar chart for sentiment score */}
                    <div className="mt-3 mb-4">
                      <div className="w-full h-7 bg-black/50 rounded-md overflow-hidden relative">
                        {/* Gradient bar */}
                        <div 
                          className="h-full rounded-md flex items-center justify-end pr-2 text-xs font-medium"
                          style={{ 
                            width: `${result.sentimentScore}%`, 
                            background: `linear-gradient(90deg, ${regionColor}50, ${regionColor})`,
                            boxShadow: `0 0 10px ${regionColor}50`
                          }}
                        ></div>
                        {/* Label */}
                        <div className="absolute inset-0 flex items-center justify-between px-3 text-xs">
                          <span className="text-white font-medium">Sentiment Score</span>
                          <span className="text-white font-bold">{result.sentimentScore}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Opinion preview */}
                    <div className="text-sm text-gray-200 line-clamp-2 mb-3 font-medium italic">
                      "{result.opinion.length > 100 ? result.opinion.substring(0, 100) + '...' : result.opinion}"
                    </div>
                    
                    {/* Click for details indicator */}
                    <div className="flex justify-end mt-2">
                      <span className="text-xs text-gray-400 flex items-center">
                        <span className="mr-1 w-2 h-2 rounded-full bg-blue-400 animate-pulse"></span>
                        Click for details
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
        
        {/* Detailed Glassmorphism Modal */}
        {showDetailModal && selectedPersona && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-5">
            {/* Backdrop with blur */}
            <div 
              className="absolute inset-0 backdrop-blur-md bg-black/70"
              onClick={() => setShowDetailModal(false)}
            ></div>
            
            {/* Modal content */}
            <div className="relative w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-transparent">
              {/* Close button */}
              <button 
                onClick={() => setShowDetailModal(false)}
                className="absolute top-3 right-3 z-10 p-2 rounded-full bg-white/10 hover:bg-white/20 text-white"
              >
                <X size={20} />
              </button>
              
              {/* Main glassmorphism card */}
              <div className="backdrop-blur-xl bg-black/60 border border-white/10 rounded-2xl overflow-hidden">
                {/* Glass highlight effect */}
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none"></div>
                
                {/* Header with region and gradient accent */}
                <div 
                  className="p-8 relative"
                  style={{ 
                    background: `linear-gradient(to right, ${SEGMENT_COLORS[selectedPersona.region]}40, transparent)`
                  }}
                >
                  <div className="flex justify-between">
                    <div>
                      <h2 className="text-2xl font-bold text-white mb-1">{selectedPersona.region}</h2>
                      <p className="text-gray-400">Region Analysis Report</p>
                    </div>
                    <div className="flex flex-col items-end">
                      <div className="text-4xl font-bold text-white">{selectedPersona.sentimentScore}</div>
                      <div className="text-sm text-gray-400">Sentiment Score</div>
                    </div>
                  </div>
                </div>
                
                {/* Main content area */}
                <div className="p-8">
                  {/* Score visualization section */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-8">
                    {/* Sentiment score bar */}
                    <div>
                      <h3 className="text-white text-lg mb-2">Sentiment Score</h3>
                      <div className="h-16 bg-black/40 rounded-xl overflow-hidden relative">
                        <div 
                          className="h-full rounded-xl flex items-center justify-end"
                          style={{ 
                            width: `${selectedPersona.sentimentScore}%`, 
                            background: `linear-gradient(90deg, ${SEGMENT_COLORS[selectedPersona.region]}50, ${SEGMENT_COLORS[selectedPersona.region]})`,
                            boxShadow: `0 0 15px ${SEGMENT_COLORS[selectedPersona.region]}30`
                          }}
                        >
                          <span className="text-white font-bold text-lg pr-4">{selectedPersona.sentimentScore}%</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Attention score bar */}
                    <div>
                      <h3 className="text-white text-lg mb-2">Attention Score</h3>
                      <div className="h-16 bg-black/40 rounded-xl overflow-hidden relative">
                        <div 
                          className="h-full rounded-xl flex items-center justify-end"
                          style={{ 
                            width: `${selectedPersona.attentionScore}%`, 
                            background: `linear-gradient(90deg, #EAB30850, #EAB308)`,
                            boxShadow: '0 0 15px rgba(234, 179, 8, 0.3)'
                          }}
                        >
                          <span className="text-white font-bold text-lg pr-4">{selectedPersona.attentionScore}%</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Detail sections */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left column */}
                    <div className="space-y-6">
                      {/* Opinion section */}
                      <div className="bg-white/5 rounded-xl p-6">
                        <h3 className="text-white text-lg mb-4 flex items-center">
                          <span className="w-2 h-2 rounded-full bg-blue-400 mr-2"></span>
                          Opinion
                        </h3>
                        <p className="text-gray-200 italic">"{selectedPersona.opinion}"</p>
                      </div>
                      
                      {/* Action items */}
                      <div className="bg-white/5 rounded-xl p-6">
                        <h3 className="text-white text-lg mb-4 flex items-center">
                          <span className="w-2 h-2 rounded-full bg-green-400 mr-2"></span>
                          Recommended Actions
                        </h3>
                        <ul className="space-y-3">
                          {selectedPersona.actionItems.map((item, i) => (
                            <li key={i} className="flex items-start">
                              <span className="text-green-400 mr-2 pt-1">•</span>
                              <span className="text-gray-200">{item}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                    
                    {/* Right column */}
                    <div>
                      {/* Detailed thoughts */}
                      <div className="bg-white/5 rounded-xl p-6 h-full">
                        <h3 className="text-white text-lg mb-4 flex items-center">
                          <span className="w-2 h-2 rounded-full bg-purple-400 mr-2"></span>
                          Detailed Analysis
                        </h3>
                        <div className="text-gray-200 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                          {selectedPersona.thoughts}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Persona Excerpt */}
                  {selectedPersona.personaExcerpt && (
                    <div className="mt-6 bg-white/5 rounded-xl p-6">
                      <h3 className="text-white text-lg mb-4 flex items-center">
                        <span className="w-2 h-2 rounded-full bg-yellow-400 mr-2"></span>
                        Persona Information
                      </h3>
                      <div className="text-gray-300 max-h-48 overflow-y-auto pr-2 custom-scrollbar">
                        {selectedPersona.personaExcerpt}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
        
        {/* The interactive graph */}
        <div className="w-full h-full">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeColor={node => {
              if (isTesting) {
                // During testing, blinking nodes get their original color
                // Other nodes are gray
                return blinkingNodes.has(node.id) ? node.color : "#555555";
              }
              // For hover effects, use highlighted flag
              if (node.id === highlightedNodeId) {
                return node.color; // Use original color but brighter
              }
              return node.color;
            }}
            nodeRelSize={2.5} // Slightly smaller relative node size
            d3AlphaDecay={0.3} // Higher decay for faster settling
            d3VelocityDecay={0.5} // Higher decay to reduce movement
            warmupTicks={50}
            cooldownTicks={50}
            cooldownTime={1000}
            linkWidth={link => link.value * 1.5} // Thinner links
            linkColor={(link) => {
              // Use link's alpha property for transparency
              const baseColor = '#ffffff';
              const alpha = link.alpha || 0.2;
              return `${baseColor}${Math.floor(alpha * 255).toString(16).padStart(2, '0')}`;
            }}
            linkLineDash={(link) => link.type === 'dashed' ? [2, 2] : []}
            backgroundColor="#000000"
            nodeVal={node => Math.pow(node.size, 2.2)} // Spacing based on node size
            enableNodeDrag={false} // Disable node dragging to prevent layout shifts
            minZoom={0.5}
            maxZoom={5}
            // Use minimal force configuration
            d3Force={(id, force) => {
              // After the initial layout, fix all node positions
              if (nodesFixedRef.current && (id === 'charge' || id === 'center' || id === 'link')) {
                // Set to minimal values or disable forces once nodes are fixed
                if (id === 'charge' && force.strength) {
                  force.strength(0);
                }
                if (id === 'center' && force.strength) {
                  force.strength(0);
                }
              } else {
                // Initial layout forces
                if (id === 'charge') {
                  force.strength(-150);
                }
                if (id === 'link') {
                  force.distance(30).strength(0.4);
                }
                if (id === 'center') {
                  force.strength(0.2);
                }
              }
            }}
            nodeCanvasObjectMode={() => 'after'}
            // Simplified hover handler that only updates highlighted node ID 
            // without causing any position changes
            onNodeHover={node => {
              setHighlightedNodeId(node ? node.id : null);
            }}
            // Fixed node canvas rendering function
            nodeCanvasObject={(node, ctx, globalScale) => {
              // Use fixed position
              const renderX = node.fx !== undefined ? node.fx : node.x;
              const renderY = node.fy !== undefined ? node.fy : node.y;
              
              const size = node.size || 3;
              const isBlinking = blinkingNodes.has(node.id);
              const isHighlighted = node.id === highlightedNodeId;
              
              // Determine if we need to apply patterns based on zoom level
              const showDetail = globalScale > 1.2;
              
              // Define pattern based on node's patternId - simplified patterns
              const renderPattern = () => {
                // Only apply pattern if we're showing detail and node has a pattern
                if (!showDetail || node.patternId === 0) return false;
                
                switch(node.patternId) {
                  case 1:
                    // Simple ring
                    ctx.beginPath();
                    ctx.arc(renderX, renderY, size * 0.7, 0, 2 * Math.PI);
                    ctx.strokeStyle = hexToRGBA('#ffffff', 0.4);
                    ctx.lineWidth = 0.5;
                    ctx.stroke();
                    break;
                  case 2:
                    // Dot in center
                    ctx.beginPath();
                    ctx.arc(renderX, renderY, size * 0.3, 0, 2 * Math.PI);
                    ctx.fillStyle = hexToRGBA('#ffffff', 0.5);
                    ctx.fill();
                    break;
                  case 3:
                    // Ring pattern with lighter color
                    ctx.beginPath();
                    ctx.arc(renderX, renderY, size * 0.7, 0, 2 * Math.PI);
                    ctx.strokeStyle = hexToRGBA('#ffffff', 0.3);
                    ctx.lineWidth = size * 0.15;
                    ctx.stroke();
                    return true;
                  case 4:
                    // Small dot outline
                    ctx.beginPath();
                    ctx.arc(renderX, renderY, size * 0.8, 0, 2 * Math.PI);
                    ctx.strokeStyle = hexToRGBA('#ffffff', 0.3);
                    ctx.lineWidth = size * 0.1;
                    ctx.stroke();
                    return true;
                  default:
                    // No pattern
                    break;
                }
                return false;
              };
              // Draw the base shape - mostly circles for visual consistency
              if (node.shape === 'square' && showDetail) {
                // Only draw squares when zoomed in enough
                ctx.beginPath();
                const roundedCorners = 0.2; // slight rounding
                ctx.roundRect(renderX - size/2, renderY - size/2, size, size, [size * roundedCorners]);
              } else {
                ctx.beginPath();
                ctx.arc(renderX, renderY, size, 0, 2 * Math.PI);
              }
              
              // Fill based on testing state
              if (isTesting) {
                if (isBlinking) {
                  // Subtler glow effect
                  const glow = ctx.createRadialGradient(
                    renderX, renderY, size * 0.5,
                    renderX, renderY, size * 2
                  );
                  glow.addColorStop(0, hexToRGBA(node.color, 0.7));
                  glow.addColorStop(1, hexToRGBA(node.color, 0));
                  ctx.fillStyle = glow;
                  ctx.fill();
                  
                  // Redraw the shape for the solid fill
                  if (node.shape === 'square' && showDetail) {
                    ctx.beginPath();
                    ctx.roundRect(renderX - size/2, renderY - size/2, size, size, [size * 0.2]);
                  } else {
                    ctx.beginPath();
                    ctx.arc(renderX, renderY, size, 0, 2 * Math.PI);
                  }
                  ctx.fillStyle = node.color;
                } else {
                  // Gray out non-blinking nodes
                  ctx.fillStyle = "#555555";
                }
              } else {
                // Normal state - apply a slight transparency to reduce visual weight
                ctx.fillStyle = hexToRGBA(node.color, 0.9);
              }
              ctx.fill();
              
              // Apply patterns if showing detail
              if (showDetail) {
                renderPattern();
              }
              
              // Draw highlight for hovered node
              if (isHighlighted) {
                // Draw a halo around the node
                ctx.beginPath();
                if (node.shape === 'square' && showDetail) {
                  const highlightSize = size * 1.3;
                  ctx.roundRect(renderX - highlightSize/2, renderY - highlightSize/2, highlightSize, highlightSize, [size * 0.2]);
                } else {
                  ctx.arc(renderX, renderY, size * 1.3, 0, 2 * Math.PI);
                }
                ctx.strokeStyle = hexToRGBA('#ffffff', 0.6);
                ctx.lineWidth = size * 0.15;
                ctx.stroke();
                
                // Draw info panel instead of text directly on canvas
                const panelWidth = 120;
                const panelHeight = 45;
                const panelX = renderX + 15; // Position to the right
                const panelY = renderY - 10;
                
                // Draw panel background with subtle transparency
                ctx.fillStyle = hexToRGBA('#111111', 0.85);
                ctx.beginPath();
                ctx.roundRect(panelX, panelY, panelWidth, panelHeight, [5]);
                ctx.fill();
                
                // Add subtle border
                ctx.strokeStyle = hexToRGBA('#444444', 0.5);
                ctx.lineWidth = 1;
                ctx.stroke();
                
                // Draw name with shadow for better readability
                ctx.font = '10px Arial';
                ctx.textAlign = 'left';
                ctx.textBaseline = 'top';
                
                // Text shadow effect
                ctx.fillStyle = '#000000';
                ctx.fillText(node.name, panelX + 7 + 1, panelY + 10 + 1); // Shadow offset
                
                // Actual text
                ctx.fillStyle = '#ffffff';
                ctx.fillText(node.name, panelX + 7, panelY + 10);
                
                // Draw ID below
                ctx.fillStyle = '#aaaaaa';
                ctx.font = '9px Arial';
                ctx.fillText(node.displayId, panelX + 7, panelY + 25);
              }
              
              // Apply subtle pulsing effect during testing
              if (isTesting && !isBlinking && Math.random() < 0.005) { // Reduced frequency
                const pulseSize = size * (1 + Math.sin(Date.now() * 0.008 * node.pulseRate) * 0.15);
                ctx.beginPath();
                ctx.arc(renderX, renderY, pulseSize, 0, 2 * Math.PI);
                ctx.strokeStyle = hexToRGBA(node.color, 0.2); // More subtle
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            }}
            onNodeClick={(node) => {
              if (graphRef.current) {
                graphRef.current.centerAt(node.fx || node.x, node.fy || node.y, 1000);
                graphRef.current.zoom(2, 1000);
              }
            }}
            linkDirectionalParticles={(link) => link.strength * 4}
            linkDirectionalParticleSpeed={(link) => link.strength * 0.01}
          />
        </div>
        
        {/* Testing message overlay */}
        {isTesting && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="bg-gray-900 bg-opacity-80 p-6 rounded-md max-w-xl text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-white mx-auto mb-4"></div>
              <p>{testingMessage}</p>
            </div>
          </div>
        )}
        
        {/* Input panel – shown when not testing and not showing results */}
        {!isTesting && !showResults && (
          <animated.div
            style={inputPanelAnimation}
            className="absolute bottom-0 left-1/2 transform -translate-x-1/2 w-full max-w-2xl bg-gray-900 rounded-t-lg border border-gray-800 border-b-0 p-4"
          >
            <div className="flex justify-end mb-4">
              <button 
                className="bg-white text-black px-4 py-1 rounded-md flex items-center"
                onClick={runSimulation}
                disabled={isLoading}
              >
                <span>Simulate</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
            <textarea
              className="w-full h-24 bg-transparent border border-gray-800 rounded-md p-3 focus:outline-none focus:border-blue-500"
              placeholder="Type your product or service description here..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            ></textarea>
          </animated.div>
        )}
        
        {/* Results input panel – shown when showing results */}
        {showResults && (
          <div className="absolute bottom-0 left-0 right-0 p-4 bg-gray-900 border-t border-gray-800">
            <div className="max-w-2xl mx-auto">
              <div className="flex justify-between">
                <button
                  onClick={() => setEditMode(!editMode)}
                  className="text-gray-400 hover:text-white"
                >
                  {editMode ? 'Hide' : 'Edit'} 
                  <svg className="inline-block w-4 h-4 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>
                <div className="flex">
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText(productDescription);
                      toast.success("Copied to clipboard!");
                    }}
                    className="text-gray-400 hover:text-white mr-2"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3" />
                    </svg>
                  </button>
                  <button
                    onClick={() => setEditMode(!editMode)}
                    className="text-gray-400 hover:text-white"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                    </svg>
                  </button>
                </div>
              </div>
              <div className="mt-2">
                {editMode ? (
                  <textarea
                    className="w-full h-24 bg-transparent border border-gray-800 rounded-md p-3 focus:outline-none focus:border-blue-500"
                    value={productDescription}
                    onChange={(e) => setProductDescription(e.target.value)}
                  ></textarea>
                ) : (
                  <div className="text-gray-300">
                    {productDescription}
                  </div>
                )}
              </div>
              {editMode && (
                <div className="mt-2 flex justify-end">
                  <button
                    onClick={() => {
                      setEditMode(false);
                      runSimulation();
                    }}
                    className="bg-blue-600 text-white px-3 py-1 rounded-md text-sm"
                  >
                    Run Simulation Again
                  </button>
                </div>
              )}
              <div className="mt-2 flex justify-center">
                <button
                  onClick={resetSimulation}
                  className="bg-red-600 text-white px-3 py-1 rounded-md text-sm"
                >
                  New Simulation
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default InitialView;