
import { SimulationNodeDatum, SimulationLinkDatum } from 'd3';

export interface GraphNode extends SimulationNodeDatum {
    id: string;
    title?: string;
    group: string; // The parent keyword or category (using Tag name)
    val: number; // Size/weight of the node
    isHub?: boolean; // Is this a hub node?
    color?: string; // Color of the node (based on Tag)
    x?: number;
    y?: number;
    vx?: number;
    vy?: number;
    fx?: number | null;
    fy?: number | null;
}

export interface GraphLink extends SimulationLinkDatum<GraphNode> {
    source: string | GraphNode;
    target: string | GraphNode;
    value: number; // Thickness/strength
}

export interface GraphData {
    nodes: GraphNode[];
    links: GraphLink[];
}

export interface FilterSettings {
    showOrphans: boolean;
    nodeSize: number;
    linkThickness: number;
    repulsion: number;
}
