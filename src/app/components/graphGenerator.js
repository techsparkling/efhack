/**
 * Enhanced graph generation function to ensure all nodes are interconnected
 * and to create better community structure.
 */
export const generateEnhancedGraph = (personas, activeSegments, SEGMENT_COLORS) => {
  const nodes = [];
  const links = [];
  
  // Step 1: Create node objects
  personas.forEach(persona => {
    const segmentId = persona.segment.toLowerCase().replace(' ', '-');
    if (activeSegments.includes('all') || activeSegments.includes(segmentId)) {
      nodes.push({
        id: persona.id,
        persona,
        name: persona.name,
        displayId: persona.displayId,
        color: SEGMENT_COLORS[persona.segment] || "#999999",
        size: persona.size,
        shape: persona.shape,
        patternId: persona.patternId,
        pulseRate: persona.pulseRate,
        alpha: 1, // Full opacity to start
        highlighted: false,
        originalColor: SEGMENT_COLORS[persona.segment] || "#999999"
      });
    }
  });
  
  // Step 2: Organize nodes by segment
  const segmentGroups = {};
  nodes.forEach(node => {
    const segment = node.persona.segment;
    if (!segmentGroups[segment]) {
      segmentGroups[segment] = [];
    }
    segmentGroups[segment].push(node);
  });
  
  // Step 3: First ensure ALL nodes are connected within their segments (spanning tree)
  Object.values(segmentGroups).forEach(segmentNodes => {
    if (segmentNodes.length > 0) {
      // Start from first node
      const connected = new Set([segmentNodes[0].id]);
      const unconnected = new Set(segmentNodes.slice(1).map(n => n.id));
      
      // Keep connecting nodes until all are connected
      while (unconnected.size > 0) {
        // Pick a random connected node as source
        const connectedArray = Array.from(connected);
        const sourceId = connectedArray[Math.floor(Math.random() * connectedArray.length)];
        
        // Pick a random unconnected node as target
        const unconnectedArray = Array.from(unconnected);
        const targetId = unconnectedArray[Math.floor(Math.random() * unconnectedArray.length)];
        
        // Create link between them
        links.push({
          source: sourceId,
          target: targetId,
          value: 0.2, // Moderate thickness
          type: "solid", // Main structure is solid
          strength: 0.4, // Stronger connections within segments
          alpha: 0.5 // Slightly more visible
        });
        
        // Mark target as connected
        connected.add(targetId);
        unconnected.delete(targetId);
      }
    }
  });
  
  // Step 4: Ensure all segments are connected to each other (spanning tree between segments)
  const segments = Object.keys(segmentGroups);
  for (let i = 0; i < segments.length; i++) {
    const sourceSegment = segments[i];
    const targetSegment = segments[(i + 1) % segments.length]; // Connect to the next segment (circular)
    
    if (segmentGroups[sourceSegment].length > 0 && segmentGroups[targetSegment].length > 0) {
      // Pick random nodes from each segment
      const sourceNode = segmentGroups[sourceSegment][Math.floor(Math.random() * segmentGroups[sourceSegment].length)];
      const targetNode = segmentGroups[targetSegment][Math.floor(Math.random() * segmentGroups[targetSegment].length)];
      
      // Create cross-segment link
      links.push({
        source: sourceNode.id,
        target: targetNode.id,
        value: 0.15, // Thinner than intra-segment
        type: "dashed", // Dashed to distinguish cross-segment
        strength: 0.2, // Weaker to allow segments to stay somewhat separate
        alpha: 0.3 // More transparent
      });
    }
  }
  
  // Step 5: Add additional random connections for richness
  nodes.forEach((node, i) => {
    // Create a weighted connection strategy
    let extraConnections;
    if (i % 10 === 0) {
      // 10% of nodes are hubs with more connections
      extraConnections = Math.floor(Math.random() * 3) + 4;
    } else if (i % 3 === 0) {
      // 30% have moderate extra connectivity
      extraConnections = Math.floor(Math.random() * 2) + 2;
    } else {
      // 60% have minimal extra connectivity
      extraConnections = Math.random() < 0.8 ? 1 : 0;
    }
    
    const sameSegmentNodes = segmentGroups[node.persona.segment].filter(n => n.id !== node.id);
    
    // Track existing connections to avoid duplicates
    const existingConnections = new Set(
      links.filter(link => 
        (typeof link.source === 'string' ? link.source : link.source.id) === node.id || 
        (typeof link.target === 'string' ? link.target : link.target.id) === node.id
      ).map(link => {
        const sourceId = typeof link.source === 'string' ? link.source : link.source.id;
        const targetId = typeof link.target === 'string' ? link.target : link.target.id;
        return sourceId === node.id ? targetId : sourceId;
      })
    );
    
    // Add extra intra-segment connections
    for (let j = 0; j < Math.min(extraConnections, sameSegmentNodes.length); j++) {
      // Find nodes not already connected
      const availableNodes = sameSegmentNodes.filter(n => !existingConnections.has(n.id));
      if (availableNodes.length === 0) break;
      
      // Select a random node
      const targetNode = availableNodes[Math.floor(Math.random() * availableNodes.length)];
      
      // Create new connection
      links.push({
        source: node.id,
        target: targetNode.id,
        value: Math.random() * 0.15 + 0.05, // Varied thickness
        type: Math.random() > 0.8 ? "dashed" : "solid", // Mostly solid
        strength: Math.random() * 0.3 + 0.1, // Varied strength
        alpha: 0.3 // Subtle links
      });
      
      // Track this connection
      existingConnections.add(targetNode.id);
    }
    
    // Add some cross-segment connections (30% chance per node)
    if (Math.random() < 0.3) {
      // Find nodes from other segments
      const otherSegments = Object.keys(segmentGroups).filter(seg => seg !== node.persona.segment);
      if (otherSegments.length > 0) {
        const randomSegment = otherSegments[Math.floor(Math.random() * otherSegments.length)];
        const targetNodes = segmentGroups[randomSegment];
        
        if (targetNodes.length > 0) {
          // Select a random node from other segment
          const targetNode = targetNodes[Math.floor(Math.random() * targetNodes.length)];
          
          // Check if already connected
          if (!existingConnections.has(targetNode.id)) {
            // Create cross-segment link
            links.push({
              source: node.id,
              target: targetNode.id,
              value: 0.08, // Very thin
              type: "dashed", // Always dashed
              strength: 0.15, // Weaker
              alpha: 0.25 // More transparent
            });
          }
        }
      }
    }
  });
  
  return { nodes, links };
};