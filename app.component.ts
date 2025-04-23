import { Component, AfterViewInit, ElementRef, ViewChild, ChangeDetectionStrategy, NgZone } from '@angular/core';
import { CommonModule } from '@angular/common';
import * as d3 from 'd3';

interface HierarchyNode {
  name: string;
  children?: HierarchyNode[];
  value?: number;
}

interface PartitionHierarchyNode extends d3.HierarchyRectangularNode<HierarchyNode> {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  current?: PartitionHierarchyNode;
}

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css'],
  changeDetection: ChangeDetectionStrategy.OnPush
})
export class AppComponent implements AfterViewInit {
  @ViewChild('sunburstChart', { static: false }) private chartContainer!: ElementRef;

  svgWidth = 480;
  svgHeight = 480;
  radius = this.svgWidth / 2;
  innerCircleRadius = 65;

  private data: HierarchyNode = {
    name: "ABITDA",
    children: [
      { name: "Business Impact", children: [{ name: "Expenditure" }, { name: "Revenue Growth" }, { name: "Customer Satisfaction" }, { name: "Cost Savings" }, { name: "Market Positioning" }, { name: "Talent" }] },
      { name: "Innovation", children: [{ name: "Innovation Inputs" }, { name: "Innovation Process" }, { name: "Innovation Outputs" }, { name: "Innovation Outcomes" }] },
      { name: "Talent", children: [{ name: "Talent Acquisition" }, { name: "Talent Development" }, { name: "Employee Engagement" }, { name: "Retention" }, { name: "Talent Productivity" }] },
      { name: "Delivery", children: [{ name: "Time to market" }, { name: "Efficiency" }, { name: "Quality" }, { name: "Customer Quality" }, { name: "Resource Utilization" }] },
      { name: "Alignment", children: [{ name: "Goal Clarity" }, { name: "Communications" }, { name: "Cross-functional collaboration" }, { name: "Customer Feedback" }, { name: "Product Strategy" }] }
    ]
  };

  constructor(private ngZone: NgZone) {}

  ngAfterViewInit(): void {
    this.ngZone.runOutsideAngular(() => {
      setTimeout(() => this.createChart(), 0); // ✅ Added setTimeout to wait for DOM to stabilize
    });
  }

  private wrapText(
    selection: d3.Selection<SVGTextElement, PartitionHierarchyNode, any, any>,
    availableWidth: (d: PartitionHierarchyNode) => number
  ): void {
    selection.each((d, i, nodes) => {
      const currentNode = nodes[i];
      if (!currentNode) return;
      const textElement = d3.select(currentNode);
      const nodeData = d;

      // Skip formatting for Business Impact label
      if (nodeData.data.name === "Business Impact") return;

      textElement.text(null);
      const words = nodeData.data.name.split(/\s+/).reverse();
      let word;
      let line: string[] = [];
      let lineNumber = 0;
      const lineHeight = 1.1;
      const dy = parseFloat(textElement.attr("dy") || "0.35");
      const initialTransform = textElement.attr("transform");
      const width = availableWidth(nodeData);

      let tspan = textElement.append("tspan").attr("x", 0).attr("dy", `${dy}em`);

      // Adjust the wrapping logic here
      while ((word = words.pop())) {
        line.push(word);
        tspan.text(line.join(" "));
        const node = tspan.node();
        let textLength = 0;
        if (node) {
          try {
            textLength = node.getComputedTextLength();
          } catch (e) {
            textLength = line.join(" ").length * 6;
          }
        }

        // Check if text exceeds width, adjust wrapping logic
        if (textLength > width && line.length > 1) {
          line.pop();
          tspan.text(line.join(" "));
          line = [word];
          tspan = textElement.append("tspan")
            .attr("x", 0)
            .attr("dy", `${++lineNumber * lineHeight}em`)
            .text(word);
        }
      }

      // Adjust vertical shift for better positioning inside circle
      if (lineNumber > 0 && initialTransform) {
        const verticalShift = -(lineNumber * lineHeight * 0.5) * parseFloat(textElement.style('font-size') || '10') * 0.5;
        textElement.attr("transform", `${initialTransform} translate(0, ${verticalShift})`);
      } else if (initialTransform) {
        textElement.attr("transform", initialTransform);
      }
    });
  }

  private handleBusinessImpactLabel(
    selection: d3.Selection<SVGTextElement, PartitionHierarchyNode, any, any>
  ): void {
    selection.text(null);
    selection.append("tspan").attr("x", 0).attr("dy", "-0.1em").text("Business");
    selection.append("tspan").attr("x", 0).attr("dy", "1.1em").text("Impact");
  }

  private createChart(): void {
    if (!this.chartContainer?.nativeElement) return;

    const element = this.chartContainer.nativeElement;
    d3.select(element).select('svg').remove();

    const width = this.svgWidth;
    const height = this.svgHeight;
    const radius = this.radius;
    const innerCircleRadius = this.innerCircleRadius;

    const partition = (data: HierarchyNode) => {
      const rootNode = d3.hierarchy(data).sum(d => d.children ? 0 : 1).sort((a, b) => (b.value ?? 0) - (a.value ?? 0));
      return d3.partition<HierarchyNode>().size([2 * Math.PI, radius * 0.9])(rootNode);
    };

    const arc = d3.arc<PartitionHierarchyNode>()
      .startAngle(d => d.x0)
      .endAngle(d => d.x1)
      .padAngle(d => Math.min((d.x1 - d.x0) / 2, 0.005))
      .padRadius(radius / 2)
      .innerRadius(d => d.depth === 1 ? innerCircleRadius + 3 : d.y0 + 3)
      .outerRadius(d => d.y1 - 3);

    const color = d3.scaleOrdinal(d3.schemeCategory10);
    const root = partition(this.data) as PartitionHierarchyNode;
    root.each(d => (d as any).current = d);

    const svg = d3.select(element).append("svg")
      .attr("viewBox", [-width / 2, -height / 2, width, height])
      .style("max-width", `${width}px`)
      .style("height", "auto")
      .style("font", "11px 'Segoe UI', sans-serif");

    const path = svg.append("g").selectAll("path")
      .data(root.descendants().slice(1))
      .join("path")
      .attr("fill", d => {
        let ancestor = d;
        while (ancestor.depth > 1) ancestor = ancestor.parent!;
        return color(ancestor.data.name);
      })
      .attr("fill-opacity", 0.8)
      .attr("d", arc)
      .style("cursor", "pointer")
      .on("click", (event, d) => this.handleArcClick(d as PartitionHierarchyNode))
      .append("title")
      .text(d => d.ancestors().map(a => a.data.name).reverse().join(" > "));

    const labelGroup = svg.append("g")
      .attr("pointer-events", "none")
      .attr("text-anchor", "middle")
      .style("user-select", "none");

    const labels = labelGroup.selectAll("text")
      .data(root.descendants().slice(1))
      .join("text")
      .attr("class", d => d.depth === 1 ? "level1-radial-label" : "subcategory-label")
      .attr("dy", "0.35em")
      .attr("fill", "#fff")
      .attr("transform", d => {
        const x = (d.x0 + d.x1) / 2 * 180 / Math.PI;
        const y = (d.y0 + d.y1) / 2;
        return `rotate(${x - 90}) translate(${y},0) rotate(${x < 180 ? 0 : 180})`;
      })
      .style("font-size", d => d.depth === 1 ? "13px" : "8px")
      .style("font-weight", d => d.depth === 1 ? "600" : "normal");


    // Apply custom label logic
    labels.each((d, i, nodes) => {
      const currentNode = nodes[i];
      if (!currentNode) return;
      const textElement = d3.select(currentNode as SVGTextElement);
      const nodeData = d as PartitionHierarchyNode;

      if (nodeData.data.name === "Business Impact") {
        this.handleBusinessImpactLabel(textElement.datum(nodeData));
      } else {
        const availableWidthFunc = (n: PartitionHierarchyNode): number => {
          const midRadius = (n.y0 + n.y1) / 2;
          const angle = n.x1 - n.x0;
          return angle * midRadius * 0.75;
        };
        this.wrapText(textElement.datum(nodeData), availableWidthFunc);
      }
    });

    // Center circle and label
    const centerGroup = svg.append("g").attr("text-anchor", "middle");

    centerGroup.append("circle")
      .attr("r", innerCircleRadius)
      .attr("fill", "#fff")
      .attr("stroke", "#a000c8")
      .attr("stroke-width", 3)
      .style("filter", "drop-shadow(0 0 4px rgba(0,0,0,0.1))");

      centerGroup.append("text")
      .attr("class", "main-label")
      .attr("dy", "0.35em")
      .style("font-size", "28px") // increased from 20px to 28px
      .style("font-weight", "bold") // added bold
      .style("fill", "#a000c8")
      .text(root.data.name);    
  }

  private handleArcClick(d: PartitionHierarchyNode): void {
    console.log("Clicked on:", d.ancestors().map(a => a.data.name).reverse().join(" > "));
  }

  onDefineScope(): void {
    console.log('Define Scope button clicked!');
  }
}
