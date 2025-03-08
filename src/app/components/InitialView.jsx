// File: src/components/SimulatorPage.jsx
'use client'
import React, { useState, useEffect, useRef } from 'react';
import { useSpring, animated } from 'react-spring';
import ForceGraph2D from 'react-force-graph-2d';
import { toast } from 'react-toastify';
import { MOCK_PERSONA_DATA } from './mockData';

// Define new color mapping for Indian segments
const SEGMENT_COLORS = {
  "North India": "#FF5733", // Vibrant Red
  "South India": "#33FF57", // Bright Green
  "East India": "#3357FF",  // Vivid Blue
  "West India": "#F1C40F"   // Sunny Yellow
};

const SEGMENT_LABELS = [
  { id: "all", name: "All segments" },
  { id: "north-india", name: "North India", color: SEGMENT_COLORS["North India"] },
  { id: "south-india", name: "South India", color: SEGMENT_COLORS["South India"] },
  { id: "east-india", name: "East India", color: SEGMENT_COLORS["East India"] },
  { id: "west-india", name: "West India", color: SEGMENT_COLORS["West India"] }
];

const InitialView = () => {
  const [productDescription, setProductDescription] = useState('');
  const [graphData, setGraphData] = useState({ nodes: [], links: [] });
  const [isLoading, setIsLoading] = useState(false);
  const [isTesting, setIsTesting] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [simulationResults, setSimulationResults] = useState(null);
  const [credits, setCredits] = useState(8);
  const [openrouterKey, setOpenrouterKey] = useState();
  const [activeSegments, setActiveSegments] = useState(['all']);
  const [personas, setPersonas] = useState([]);
  const [testingMessage, setTestingMessage] = useState('');
  const [editMode, setEditMode] = useState(false);
  const [blinkingNodes, setBlinkingNodes] = useState(new Set());
  const graphRef = useRef();

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

  // Load API key and generate graph on mount
  useEffect(() => {
    setOpenrouterKey(process.env.REACT_APP_OPENROUTER_KEY || '')
    generatePersonas();
  }, []);

  // Generate graph when personas or active segments change
  useEffect(() => {
    if (personas.length > 0) {
      generateGraph();
    }
  }, [personas, activeSegments]);

  // Background animation effect during testing:
  // Periodically update blinking nodes so that during testing most nodes turn grey
  // while a subset glow with their original color.
  useEffect(() => {
    if (isTesting) {
      const interval = setInterval(() => {
        const nodeCount = graphData.nodes.length;
        const blinkCount = Math.min(nodeCount, 20); // Blink up to 20 nodes at a time
        
        const newBlinkingNodes = new Set();
        for (let i = 0; i < blinkCount; i++) {
          const randomNodeIndex = Math.floor(Math.random() * nodeCount);
          if (randomNodeIndex < nodeCount && graphData.nodes[randomNodeIndex]) {
            newBlinkingNodes.add(graphData.nodes[randomNodeIndex].id);
          }
        }
        setBlinkingNodes(newBlinkingNodes);
      }, 500);
      
      return () => clearInterval(interval);
    } else {
      setBlinkingNodes(new Set());
    }
  }, [isTesting, graphData.nodes]);

  // Function to generate personas with Indian segments
  const generatePersonas = () => {
    // Use new segments representing parts of India
    const segments = ["North India", "South India", "East India", "West India"];
    const generatedPersonas = [];

    // Create a large number of personas
    for (let i = 0; i < 988; i++) {
      // Select a random mock persona to base attributes on
      const baseMockPersona = MOCK_PERSONA_DATA[Math.floor(Math.random() * MOCK_PERSONA_DATA.length)];
      
      // Assign segment from parts of India
      const segment = segments[Math.floor(Math.random() * segments.length)];
      
      generatedPersonas.push({
        id: `persona-${i}`,
        segment,
        attributes: { ...baseMockPersona },
        size: Math.random() * 3 + 1, // Random size between 1 and 4
      });
    }
    setPersonas(generatedPersonas);
  };

  // Function to generate network graph based on active segments
  const generateGraph = () => {
    const nodes = [];
    const links = [];
    
    personas.forEach(persona => {
      const segmentId = persona.segment.toLowerCase().replace(' ', '-');
      if (activeSegments.includes('all') || activeSegments.includes(segmentId)) {
        nodes.push({
          id: persona.id,
          persona,
          color: SEGMENT_COLORS[persona.segment] || "#999999",
          size: persona.size,
        });
      }
    });
    
    // Create links (a subset for clarity)
    for (let i = 0; i < nodes.length; i++) {
      const linkCount = Math.floor(Math.random() * 3) + 1;
      for (let j = 0; j < linkCount; j++) {
        const sameSegmentNodes = nodes.filter(n => 
          n.persona.segment === nodes[i].persona.segment && n.id !== nodes[i].id
        );
        const targetPool = Math.random() < 0.8 && sameSegmentNodes.length > 0 
          ? sameSegmentNodes 
          : nodes.filter(n => n.id !== nodes[i].id);
        
        if (targetPool.length > 0) {
          const targetNode = targetPool[Math.floor(Math.random() * targetPool.length)];
          const linkExists = links.some(link => 
            (link.source === nodes[i].id && link.target === targetNode.id) ||
            (link.source === targetNode.id && link.target === nodes[i].id)
          );
          if (!linkExists && Math.random() < 0.3) {
            links.push({
              source: nodes[i].id,
              target: targetNode.id,
              value: Math.random() * 0.5 + 0.1
            });
          }
        }
      }
    }
    setGraphData({ nodes, links });
  };

  // Toggle segment visibility
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

  // Update OpenRouter API key
  const updateApiKey = () => {
    const key = prompt("Enter your OpenRouter API key:");
    if (key) {
      localStorage.setItem('openrouter_api_key', key);
      setOpenrouterKey(key);
    }
  };

  // Run simulation and make LLM request for multiple persona responses
  const runSimulation = async () => {
    if (!productDescription.trim()) {
      toast.error("Please describe your product or service first!");
      return;
    }
    
    if (!openrouterKey && !process.env.REACT_APP_OPENROUTER_KEY) {
      toast.error("Please set your OpenRouter API key first!");
      updateApiKey();
      return;
    }
    
    if (credits <= 0) {
      toast.error("You've used all your credits. Please upgrade for more simulations.");
      return;
    }
    
    setIsTesting(true);
    setTestingMessage(`Testing with diverse personas from different parts of India. This will take ~2 mins.`);
    setInputPanelOpen(false);
    
    try {
      // Simulate network delay
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Updated system prompt for Indian segments and multiple responses
      const systemPrompt = `You are an AI that analyzes how a network of diverse personas from different parts of India (North India, South India, East India, West India) would respond to a pitch or product description.
For each segment, provide:
1. An overall sentiment score from 0-100.
2. An attention score from 0-100 indicating how memorable or interesting the pitch is.
3. A detailed 150-word analysis highlighting strengths, weaknesses, and specific feedback for that region.
4. 1-2 specific action items to improve the pitch.
Return separate responses for each persona segment.`;
      
      setTestingMessage("Analyzing network responses and generating insights...");
      
      const apiKey = openrouterKey || process.env.REACT_APP_OPENROUTER_KEY;
      
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": window.location.href,
          "X-Title": "Social-Network-Simulator",
        },
        body: JSON.stringify({
          model: "google/gemini-2.0-flash-001",
          messages: [
            { role: "system", content: systemPrompt },
            {
              role: "user",
              content: `Analyze how different people would react to this product/service description: "${productDescription}". Provide separate detailed insights for each region of India.`
            }
          ],
          max_tokens: 1000,
          temperature: 0.7,
          n: 4, 
          stream: false,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`OpenRouter API error: ${response.status} ${errorData.error || ""}`);
      }
      
      const data = await response.json();
      
      // Process each response from the LLM
      const results = data.choices.map(choice => {
        const responseText = choice.message.content;
        let sentimentScore = responseText.match(/sentiment score[:\s]*(\d+)/i)?.[1];
        sentimentScore = sentimentScore ? parseInt(sentimentScore) : Math.floor(Math.random() * 30) + 60;
        let attentionScore = responseText.match(/attention score[:\s]*(\d+)/i)?.[1];
        attentionScore = attentionScore ? parseInt(attentionScore) : Math.floor(Math.random() * 40) + 40;
        let insights = responseText;
        if (!responseText.includes("sentiment score") && !responseText.includes("attention score")) {
          const responseLines = responseText.split('\n').filter(line => line.trim());
          const insightsPart = responseLines.slice(0, -2).join('\n');
          const actionsPart = responseLines.slice(-2).join('\n');
          insights = `Wave Insights\n\n${insightsPart}\n\nWave Actions\n\n${actionsPart}`;
        }
        return {
          sentimentScore,
          attentionScore,
          insights,
          timestamp: new Date().toISOString(),
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
        
        {/* Results panel */}
        {showResults && simulationResults && (
          <div className="absolute top-16 right-4 w-80 z-10 space-y-6 overflow-y-auto" style={{ maxHeight: '80vh' }}>
            {simulationResults.map((result, index) => (
              <div key={index} className="bg-gray-900 rounded-lg p-4 border border-gray-800">
                <div className="flex justify-between items-center mb-2">
                  <div className="text-sm text-gray-400">Sentiment score</div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-5xl font-bold mb-2">{result.sentimentScore}</div>
                <div className="w-full h-2 bg-gray-800 rounded-full">
                  <div 
                    className="h-full bg-blue-500 rounded-full" 
                    style={{ width: `${result.sentimentScore}%` }}
                  ></div>
                </div>
                <div className="flex justify-between items-center my-2">
                  <div className="text-sm text-gray-400">Attention score</div>
                  <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="text-5xl font-bold mb-2">{result.attentionScore}</div>
                <div className="w-full h-2 bg-gray-800 rounded-full mb-4">
                  <div className="relative w-full">
                    <div 
                      className="absolute h-2 bg-yellow-500 rounded-full" 
                      style={{ width: `${result.attentionScore}%`, right: 0 }}
                    ></div>
                  </div>
                </div>
                {/* Insights */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 overflow-y-auto" style={{ maxHeight: '200px' }}>
                  <div className="text-sm text-gray-400 mb-2">Wave Insights</div>
                  <div className="text-sm">
                    {result.insights.split('Wave Actions')[0].split('Wave Insights').slice(-1)[0].trim()}
                  </div>
                </div>
                {/* Actions */}
                <div className="bg-gray-900 rounded-lg p-4 border border-gray-800 mt-2">
                  <div className="text-sm text-gray-400 mb-2">Wave Actions</div>
                  <div className="text-sm">
                    {result.insights.includes('Wave Actions') 
                      ? result.insights.split('Wave Actions')[1].trim()
                      : "Keep your message clear and concise. Focus on the specific problem your solution addresses."}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        
        {/* The interactive graph */}
        <div className="w-full h-full">
          <ForceGraph2D
            ref={graphRef}
            graphData={graphData}
            nodeColor={node => {
              if (isTesting) {
                return blinkingNodes.has(node.id) ? node.color : "#555555";
              }
              return node.color;
            }}
            nodeRelSize={3}
            linkWidth={link => link.value * 2}
            linkColor={() => '#ffffff20'}
            backgroundColor="#000000"
            cooldownTicks={100}
            nodeCanvasObjectMode={() => 'after'}
            nodeCanvasObject={(node, ctx, globalScale) => {
              const size = node.size || 3;
              const isBlinking = blinkingNodes.has(node.id);
              ctx.beginPath();
              ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
              
              if (isTesting) {
                if (isBlinking) {
                  // Create glow effect using the node's color
                  const glow = ctx.createRadialGradient(
                    node.x, node.y, size * 0.5,
                    node.x, node.y, size * 2
                  );
                  glow.addColorStop(0, hexToRGBA(node.color, 0.8));
                  glow.addColorStop(1, hexToRGBA(node.color, 0));
                  ctx.fillStyle = glow;
                  ctx.fill();
                  ctx.beginPath();
                  ctx.arc(node.x, node.y, size, 0, 2 * Math.PI);
                  ctx.fillStyle = node.color;
                } else {
                  ctx.fillStyle = "#555555";
                }
              } else {
                ctx.fillStyle = node.color;
              }
              ctx.fill();
            }}
            onNodeClick={(node) => {
              graphRef.current.centerAt(node.x, node.y, 1000);
              graphRef.current.zoom(2, 1000);
            }}
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
                disabled={isLoading || !openrouterKey}
              >
                <span>Simulate</span>
                <svg className="w-4 h-4 ml-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                </svg>
              </button>
            </div>
            <textarea
              className="w-full h-24 bg-transparent border border-gray-800 rounded-md p-3 focus:outline-none focus:border-blue-500"
              placeholder="Type here..."
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            ></textarea>
            {!openrouterKey && (
              <div className="mt-2 text-red-400 text-sm">
                Please set your OpenRouter API key first by clicking the info icon.
              </div>
            )}
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
