
"use client"

import React, { useEffect, useRef } from 'react';
import * as d3 from 'd3';
import { GraphData, GraphNode, GraphLink, FilterSettings } from '@/types/graph';

// Colors for the graph (can be updated to match the theme)
const COLORS = [
    "#e6194b", "#3cb44b", "#ffe119", "#4363d8", "#f58231",
    "#911eb4", "#46f0f0", "#f032e6", "#bcf60c", "#fabebe",
    "#008080", "#e6beff", "#9a6324", "#fffac8", "#800000",
    "#aaffc3", "#808000", "#ffd8b1", "#000075", "#808080",
    "#ffffff", "#000000"
];

interface GraphViewProps {
    data: GraphData;
    settings?: FilterSettings;
    width?: number;
    height?: number;
    onNodeClick?: (node: GraphNode) => void;
    className?: string;
}

const DEFAULT_SETTINGS: FilterSettings = {
    showOrphans: true,
    nodeSize: 1.5, // Increased base size
    linkThickness: 1,
    repulsion: 150 // Increased repulsion
};

export const GraphView: React.FC<GraphViewProps> = ({
    data,
    settings = DEFAULT_SETTINGS,
    width = 800,
    height = 600,
    onNodeClick,
    className
}) => {
    const svgRef = useRef<SVGSVGElement>(null);
    const zoomRef = useRef<SVGGElement>(null);
    const simulationRef = useRef<d3.Simulation<GraphNode, GraphLink> | null>(null);

    // Re-run simulation when data or settings change
    useEffect(() => {
        if (!svgRef.current || !zoomRef.current || !data.nodes.length) return;

        // Clear previous graph
        const svg = d3.select(svgRef.current);
        const container = d3.select(zoomRef.current);
        container.selectAll("*").remove();

        // Create a deep copy of data for D3 to mutate without affecting React state
        const nodes: GraphNode[] = data.nodes.map(d => ({ ...d }));
        const links: GraphLink[] = data.links.map(d => ({ ...d }));

        // Setup Simulation
        const simulation = d3.forceSimulation(nodes)
            .force("link", d3.forceLink(links).id((d: any) => d.id).distance(100))
            .force("charge", d3.forceManyBody().strength(-settings.repulsion))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("collide", d3.forceCollide().radius((d: any) => (d.val || 2) + 4).iterations(2));

        simulationRef.current = simulation;

        // Draw Links
        const link = container.append("g")
            .attr("stroke", "#404040")
            .attr("stroke-opacity", 0.6)
            .selectAll("line")
            .data(links)
            .join("line")
            .attr("stroke-width", d => Math.sqrt(d.value) * settings.linkThickness);

        // Draw Nodes
        const node = container.append("g")
            .attr("stroke", "#fff")
            .attr("stroke-width", 1.5)
            .selectAll("circle")
            .data(nodes)
            .join("circle")
            .attr("r", d => (d.isHub ? 8 : 5) * (settings.nodeSize))
            .attr("fill", d => {
                if (d.color && d.color !== '#3B82F6') return d.color; // Use tag color if available

                // Fallback to hash color
                let hash = 0;
                const groupStr = d.group || "";
                for (let i = 0; i < groupStr.length; i++) {
                    hash = groupStr.charCodeAt(i) + ((hash << 5) - hash);
                }
                const colorIndex = Math.abs(hash) % COLORS.length;
                return d.isHub ? COLORS[colorIndex] : (d.color || "#5c5c5c");
            })
            .attr("stroke", d => d.isHub ? "#fff" : "none")
            .call(drag(simulation) as any)
            .on("click", (event, d) => {
                event.stopPropagation();
                if (onNodeClick) onNodeClick(d);
            })
            .on("mouseover", function (event, d) {
                d3.select(this).attr("stroke", "#7c3aed").attr("stroke-width", 3);
                // Highlight connections
                link.attr("stroke", (l: any) => (l.source.id === d.id || l.target.id === d.id ? "#dcddde" : "#404040"))
                    .attr("stroke-opacity", (l: any) => (l.source.id === d.id || l.target.id === d.id ? 1 : 0.1));

                node.attr("opacity", (n: any) => {
                    const isConnected = links.some((l: any) => (l.source.id === d.id && l.target.id === n.id) || (l.target.id === d.id && l.source.id === n.id));
                    return (n.id === d.id || isConnected) ? 1 : 0.2;
                });

                text.attr("opacity", (n: any) => {
                    const isConnected = links.some((l: any) => (l.source.id === d.id && l.target.id === n.id) || (l.target.id === d.id && l.source.id === n.id));
                    return (n.id === d.id || isConnected) ? 1 : 0.1;
                });
            })
            .on("mouseout", function () {
                d3.select(this).attr("stroke", d => (d as any).isHub ? "#fff" : "none").attr("stroke-width", 1.5);
                link.attr("stroke", "#404040").attr("stroke-opacity", 0.6);
                node.attr("opacity", 1);
                text.attr("opacity", d => (d as any).isHub ? 1 : 0.7); // Reset to default visibility
            });


        // Draw Labels
        const text = container.append("g")
            .selectAll("text")
            .data(nodes)
            .join("text")
            .text(d => d.title || d.id.substring(0, 10))
            .attr("x", 12)
            .attr("y", 4)
            .attr("font-family", "sans-serif")
            .attr("font-size", d => d.isHub ? "14px" : "10px")
            .attr("font-weight", d => d.isHub ? "bold" : "normal")
            .attr("fill", "#dcddde")
            .attr("opacity", d => d.isHub ? 1 : 0.6)
            .style("pointer-events", "none");


        // Simulation Tick
        simulation.on("tick", () => {
            link
                .attr("x1", d => (d.source as GraphNode).x!)
                .attr("y1", d => (d.source as GraphNode).y!)
                .attr("x2", d => (d.target as GraphNode).x!)
                .attr("y2", d => (d.target as GraphNode).y!);

            node
                .attr("cx", d => d.x!)
                .attr("cy", d => d.y!);

            text
                .attr("x", d => d.x! + 10)
                .attr("y", d => d.y! + 4);
        });

        // Zoom Behavior
        const zoomBehavior = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.1, 4])
            .on("zoom", (event) => {
                container.attr("transform", event.transform);
            });

        svg.call(zoomBehavior);

        return () => {
            simulation.stop();
        };
    }, [data, width, height, settings]); // Re-run when these change

    // Drag behavior definition
    const drag = (simulation: d3.Simulation<GraphNode, GraphLink>) => {
        function dragstarted(event: any) {
            if (!event.active) simulation.alphaTarget(0.3).restart();
            event.subject.fx = event.subject.x;
            event.subject.fy = event.subject.y;
        }

        function dragged(event: any) {
            event.subject.fx = event.x;
            event.subject.fy = event.y;
        }

        function dragended(event: any) {
            if (!event.active) simulation.alphaTarget(0);
            event.subject.fx = null;
            event.subject.fy = null;
        }

        return d3.drag()
            .on("start", dragstarted)
            .on("drag", dragged)
            .on("end", dragended);
    };

    return (
        <div className={`relative w-full h-full bg-[#161616] overflow-hidden ${className}`}>
            <svg ref={svgRef} width="100%" height="100%" className="cursor-grab active:cursor-grabbing block w-full h-full">
                <g ref={zoomRef} />
            </svg>
            {/* Stats Overlay (Bottom Right) */}
            <div className="absolute bottom-4 right-4 z-40 text-xs text-gray-400 bg-black/80 px-3 py-1 rounded-full border border-gray-800 backdrop-blur pointer-events-none select-none">
                Nodes: {data.nodes.length} | Links: {data.links.length}
            </div>
        </div>
    );
};
