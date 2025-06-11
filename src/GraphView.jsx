import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";

const initialNodes = [
  { id: "노트1" },
  { id: "노트2" },
  { id: "노트3" },
  { id: "노트4" },
  { id: "노트5" }
];
const initialLinks = [
  { source: "노트1", target: "노트2" },
  { source: "노트1", target: "노트3" },
  { source: "노트2", target: "노트4" },
  { source: "노트3", target: "노트4" },
  { source: "노트4", target: "노트5" }
];

function GraphView() {
  const svgRef = useRef();
  const [nodes, setNodes] = useState(initialNodes);
  const [links, setLinks] = useState(initialLinks);
  const [selectedNode, setSelectedNode] = useState(null);
  const [newLink, setNewLink] = useState("");

  useEffect(() => {
    const width = window.innerWidth;
    const height = window.innerHeight;

    const svg = d3.select(svgRef.current)
      .attr("width", width)
      .attr("height", height)
      .style("background", "#222");

    svg.selectAll("*").remove();

    // 링크 그리기
    const link = svg.append("g")
      .attr("stroke", "#888")
      .attr("stroke-width", 2)
      .selectAll("line")
      .data(links)
      .join("line")
      .attr("class", "link")
      .attr("opacity", 0.7);

    // 노드 그리기
    const node = svg.append("g")
      .selectAll("g")
      .data(nodes)
      .join("g")
      .attr("class", "node");

    // 드래그 핸들러
    function dragstarted(event, d) {
      if (!event.active) simulation.alphaTarget(0.3).restart();
      d.fx = d.x;
      d.fy = d.y;
    }
    function dragged(event, d) {
      d.fx = event.x;
      d.fy = event.y;
    }
    function dragended(event, d) {
      if (!event.active) simulation.alphaTarget(0);
      d.fx = null;
      d.fy = null;
    }

    node.call(d3.drag()
      .on("start", dragstarted)
      .on("drag", dragged)
      .on("end", dragended)
    );

    // 노드 원
    node.append("circle")
      .attr("r", 30)
      .attr("stroke", "#fff")
      .attr("stroke-width", 2)
      .attr("fill", "#4f8cff")
      .on("click", (event, d) => {
        setSelectedNode(d);
        event.stopPropagation();
      });

    // 노드 텍스트
    node.append("text")
      .attr("class", "label")
      .attr("fill", "#fff")
      .attr("font-size", 14)
      .attr("text-anchor", "middle")
      .attr("dy", 5)
      .text(d => d.id);

    // 시뮬레이션
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id(d => d.id).distance(180))
      .force("charge", d3.forceManyBody().strength(-400))
      .force("center", d3.forceCenter(width / 2, height / 2));

    simulation.on("tick", () => {
      link
        .attr("x1", d => d.source.x)
        .attr("y1", d => d.source.y)
        .attr("x2", d => d.target.x)
        .attr("y2", d => d.target.y);

      node
        .attr("transform", d => `translate(${d.x},${d.y})`);
    });

    return () => simulation.stop();
  }, [nodes, links]);

  // 연결 추가
  const handleAddLink = () => {
    if (!newLink || !selectedNode) return;
    const newLinks = [...links, { source: selectedNode.id, target: newLink }];
    setLinks(newLinks);
    setNewLink("");
  };

  // 연결 제거
  const handleRemoveLink = (targetId) => {
    const newLinks = links.filter(link =>
      !(link.source === selectedNode.id && link.target === targetId) &&
      !(link.target === selectedNode.id && link.source === targetId)
    );
    setLinks(newLinks);
  };

  // 팝업 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = () => setSelectedNode(null);
    window.addEventListener("click", handleClickOutside);
    return () => window.removeEventListener("click", handleClickOutside);
  }, []);

  // 노드 생성 버튼 핸들러
  const handleAddNode = () => {
    // "노트N" 형태의 새로운 id 생성 (중복 방지)
    let idx = 1;
    let newId;
    do {
      idx += 1;
      newId = `노트${idx}`;
    } while (nodes.some(n => n.id === newId));
    setNodes([...nodes, { id: newId }]);
    // 연결 없음(links에는 추가하지 않음)
  };

  return (
    <>
      <svg ref={svgRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
      {selectedNode && (
        <div style={{
          position: "absolute",
          top: "20px",
          left: "20px",
          background: "white",
          padding: "20px",
          borderRadius: "8px",
          boxShadow: "0 2px 10px rgba(0,0,0,0.1)",
          zIndex: 10
        }}
        onClick={e => e.stopPropagation()}>
          <h3>노드: {selectedNode.id}</h3>
          <h4>현재 연결:</h4>
          <ul>
            {links
              .filter(link =>
                link.source === selectedNode.id ||
                link.target === selectedNode.id
              )
              .map(link => (
                <li key={`${link.source}-${link.target}`}>
                  {link.source} ↔ {link.target}
                  <button onClick={() => handleRemoveLink(link.source === selectedNode.id ? link.target : link.source)}>
                    삭제
                  </button>
                </li>
              ))}
          </ul>
          <div>
            <input
              type="text"
              value={newLink}
              onChange={(e) => setNewLink(e.target.value)}
              placeholder="연결할 노드 ID"
            />
            <button onClick={handleAddLink}>연결 추가</button>
          </div>
          <button onClick={() => setSelectedNode(null)}>닫기</button>
        </div>
      )}
      {/* 하단 우측 노드 생성 버튼 */}
      <button
        onClick={handleAddNode}
        style={{
          position: "fixed",
          bottom: "32px",
          right: "32px",
          zIndex: 100,
          background: "#1976d2",
          color: "white",
          border: "none",
          borderRadius: "50%",
          width: "60px",
          height: "60px",
          fontSize: "28px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.2)",
          cursor: "pointer"
        }}
        aria-label="노드 생성"
        title="노드 생성"
      >
        +
      </button>
    </>
  );
}

export default GraphView;
