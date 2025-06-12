import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import forceBoundary from "d3-force-boundary";

function GraphView({ nodes, setNodes, links, setLinks, loading, userId }) {
    const svgRef = useRef();
    const [selectedNode, setSelectedNode] = useState(null);
    const [newLink, setNewLink] = useState("");
    const [showCreatePopup, setShowCreatePopup] = useState(false);
    const [newNodeContent, setNewNodeContent] = useState("");
    const [newNodeId, setNewNodeId] = useState("");
    const [showCompletePopup, setShowCompletePopup] = useState(false);

    // 노트 수정 관련 상태
    const [editMode, setEditMode] = useState(false);
    const [editContent, setEditContent] = useState("");

    // 해시태그 입력 관련 상태
    const [tagInput, setTagInput] = useState("");
    const [tags, setTags] = useState([]);

    // 색상 선택 상태
    const rainbowColors = [
        "#ff4444", "#ff9800", "#ffd600", "#4caf50", "#2196f3", "#3f51b5", "#9c27b0"
    ];
    const [selectedColor, setSelectedColor] = useState(rainbowColors[0]);

    // 검색 상태
    const [searchTag, setSearchTag] = useState("");
    const [visibleNodeIds, setVisibleNodeIds] = useState(null);

    // 자기 자신 연결 에러 메시지
    const [selfLinkError, setSelfLinkError] = useState("");

    // 연결 수(degree) 계산 함수
    const calculateNodeDegrees = (nodes, links) => {
        const degrees = {};
        nodes.forEach(node => { degrees[node.id] = 0; });
        links.forEach(link => {
            const sourceId = typeof link.source === "object" ? link.source.id : link.source;
            const targetId = typeof link.target === "object" ? link.target.id : link.target;
            if (degrees[sourceId] !== undefined) degrees[sourceId]++;
            if (degrees[targetId] !== undefined) degrees[targetId]++;
        });
        return degrees;
    };

    // 검색 기능: 해시태그/내용 모두 지원
    useEffect(() => {
        if (!searchTag.trim()) {
            setVisibleNodeIds(null); // 전체 노드 보이기
        } else {
            const keyword = searchTag.replace(/^#/, "").trim().toLowerCase();
            const filteredIds = nodes.filter(node => {
                // 해시태그 일치
                const tagMatch = node.tags && node.tags.some(tag => tag.toLowerCase().includes(keyword));
                // 내용 일치
                const contentMatch = (node.content || "").toLowerCase().includes(keyword);
                return tagMatch || contentMatch;
            }).map(node => node.id);
            setVisibleNodeIds(filteredIds);
        }
    }, [searchTag, nodes]);

    useEffect(() => {
        const width = window.innerWidth;
        const height = window.innerHeight;

        const svg = d3.select(svgRef.current)
            .attr("width", width)
            .attr("height", height)
            .style("background", "#222");

        svg.selectAll("*").remove();

        // 노드/링크 필터링
        const filteredNodes = visibleNodeIds
            ? nodes.filter(n => visibleNodeIds.includes(n.id))
            : nodes;

        const filteredLinks = visibleNodeIds
            ? links.filter(link => {
                const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                const targetId = typeof link.target === "object" ? link.target.id : link.target;
                return visibleNodeIds.includes(sourceId) && visibleNodeIds.includes(targetId);
            })
            : links;

        const degrees = calculateNodeDegrees(filteredNodes, filteredLinks);

        // 링크 그리기
        const link = svg.append("g")
            .attr("stroke", "#888")
            .attr("stroke-width", 2)
            .selectAll("line")
            .data(filteredLinks)
            .join("line")
            .attr("class", "link")
            .attr("opacity", 0.7);

        // 노드 그리기
        const node = svg.append("g")
            .selectAll("g")
            .data(filteredNodes)
            .join("g")
            .attr("class", "node")
            .style("display", d =>
                visibleNodeIds ? (visibleNodeIds.includes(d.id) ? "" : "none") : ""
            )
            .on("click", (event, d) => {
                setSelectedNode(d);
                setEditMode(false);
                event.stopPropagation();
            });

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

        node.append("circle")
            .attr("r", d => 22 + (degrees[d.id] || 0) * 5)
            .attr("stroke", "#fff")
            .attr("stroke-width", 2)
            .attr("fill", d => d.color || "#4f8cff");

        node.append("text")
            .attr("class", "label")
            .attr("fill", "#fff")
            .attr("font-size", 14)
            .attr("text-anchor", "middle")
            .attr("dy", 5)
            .style("pointer-events", "visiblePainted")
            .text(d => d.id);

        const simulation = d3.forceSimulation(filteredNodes)
            .force("link", d3.forceLink(filteredLinks).id(d => d.id).distance(180))
            .force("charge", d3.forceManyBody().strength(-400))
            .force("center", d3.forceCenter(width / 2, height / 2))
            .force("boundary", forceBoundary(30, 30, width - 30, height - 30).strength(0.8));

        simulation.on("tick", () => {
            link
                .attr("x1", d => (typeof d.source === "object" ? d.source.x : filteredNodes.find(n => n.id === d.source)?.x))
                .attr("y1", d => (typeof d.source === "object" ? d.source.y : filteredNodes.find(n => n.id === d.source)?.y))
                .attr("x2", d => (typeof d.target === "object" ? d.target.x : filteredNodes.find(n => n.id === d.target)?.x))
                .attr("y2", d => (typeof d.target === "object" ? d.target.y : filteredNodes.find(n => n.id === d.target)?.y));
            node
                .attr("transform", d => `translate(${d.x},${d.y})`);
        });

        return () => simulation.stop();
    }, [nodes, links, visibleNodeIds]);

    // 연결 추가 (자기 자신 연결 방지, 에러 메시지 표시)
    const handleAddLink = () => {
        setSelfLinkError("");
        if (!newLink || !selectedNode) return;
        if (newLink === selectedNode.id) {
            setSelfLinkError("자기 자신과 연결할 수 없습니다.");
            return;
        }
        if (!nodes.some(n => n.id === newLink)) return;
        if (links.some(l =>
            (l.source === selectedNode.id && l.target === newLink) ||
            (l.source === newLink && l.target === selectedNode.id)
        )) return;
        setLinks([
            ...links,
            { source: selectedNode.id, target: newLink }
        ]);
        setNewLink("");
    };

    // 연결 제거
    const handleRemoveLink = (targetId) => {
        const newLinks = links.filter(link => {
            const sourceId = typeof link.source === "object" ? link.source.id : link.source;
            const targetId_ = typeof link.target === "object" ? link.target.id : link.target;
            return !(
                (sourceId === selectedNode.id && targetId_ === targetId) ||
                (targetId_ === selectedNode.id && sourceId === targetId)
            );
        });
        setLinks(newLinks);
    };

    // 노드 삭제 (링크도 함께 삭제)
    const handleDeleteNode = () => {
        if (!selectedNode) return;
        const newNodes = nodes.filter(n => n.id !== selectedNode.id);
        const newLinks = links.filter(link => {
            const sourceId = typeof link.source === "object" ? link.source.id : link.source;
            const targetId = typeof link.target === "object" ? link.target.id : link.target;
            return sourceId !== selectedNode.id && targetId !== selectedNode.id;
        });
        setNodes(newNodes);
        setLinks(newLinks);
        setSelectedNode(null);
        setEditMode(false);
    };

    // 팝업 외부 클릭 시 닫기
    useEffect(() => {
        const handleClickOutside = () => {
            setSelectedNode(null);
            setEditMode(false);
        };
        window.addEventListener("click", handleClickOutside);
        return () => window.removeEventListener("click", handleClickOutside);
    }, []);

    // 노드 생성 버튼 클릭 시 팝업 띄우기
    const handleAddNodeButton = () => {
        let idx = 0;
        let newId;
        do {
            idx += 1;
            newId = `노트${idx}`;
        } while (nodes.some(n => n.id === newId));
        setNewNodeId(newId);
        setNewNodeContent("");
        setTags([]);
        setTagInput("");
        setSelectedColor(rainbowColors[0]);
        setShowCreatePopup(true);
    };

    // 태그 입력 처리
    const handleTagInputKeyDown = (e) => {
        if ((e.key === "Enter" || e.key === ",") && tagInput.trim()) {
            const newTag = tagInput.replace(/^#/, "").trim();
            if (newTag && !tags.includes(newTag)) {
                setTags([...tags, newTag]);
            }
            setTagInput("");
            e.preventDefault();
        }
    };

    const handleRemoveTag = (removeTag) => {
        setTags(tags.filter(tag => tag !== removeTag));
    };

    // 노트 작성 완료 (userId, color 포함)
    const handleCreateNode = () => {
        setNodes([
            ...nodes,
            {
                id: newNodeId,
                content: newNodeContent,
                tags,
                color: selectedColor,
                x: window.innerWidth / 2,
                y: window.innerHeight / 2,
                userId
            }
        ]);
        setShowCreatePopup(false);
        setShowCompletePopup(true);
        setTimeout(() => setShowCompletePopup(false), 1500);
        setTags([]);
        setTagInput("");
        setSelectedColor(rainbowColors[0]);
    };

    // 노트 내용 수정 저장 (userId 유지)
    const handleSaveEdit = () => {
        setNodes(nodes.map(node =>
            node.id === selectedNode.id ? { ...node, content: editContent, userId } : node
        ));
        setSelectedNode({ ...selectedNode, content: editContent });
        setEditMode(false);
    };

    // 노트 내용 클릭 시 수정 모드 진입
    const handleContentClick = () => {
        setEditContent(selectedNode.content || "");
        setEditMode(true);
    };

    return (
        <>
            {/* 검색창 */}
            <div style={{
                position: "fixed",
                top: "28px",
                right: "32px",
                zIndex: 300,
                background: "rgba(255,255,255,0.97)",
                color: "#222",
                borderRadius: "8px",
                boxShadow: "0 2px 10px rgba(0,0,0,0.10)",
                border: "1px solid #ddd",
                padding: "10px 18px",
                minWidth: "220px",
                display: "flex",
                alignItems: "center",
                gap: "8px"
            }}>
                <span style={{ fontWeight: 600, color: "#1976d2" }}>#</span>
                <input
                    type="text"
                    value={searchTag}
                    onChange={e => setSearchTag(e.target.value)}
                    placeholder="해시태그 또는 내용 검색"
                    style={{
                        border: "none",
                        outline: "none",
                        fontSize: "15px",
                        background: "transparent",
                        color: "#222",
                        width: "140px"
                    }}
                />
                {searchTag && (
                    <button
                        onClick={() => setSearchTag("")}
                        style={{
                            marginLeft: "6px",
                            background: "none",
                            border: "none",
                            color: "#888",
                            fontSize: "18px",
                            cursor: "pointer"
                        }}
                        title="검색 초기화"
                    >×</button>
                )}
            </div>
            <svg ref={svgRef} style={{ width: "100vw", height: "100vh", display: "block" }} />
            {/* 안내 메시지 */}
            {nodes.length === 0 && (
                <div style={{
                    position: "absolute",
                    top: "50%",
                    left: "50%",
                    transform: "translate(-50%, -50%)",
                    color: "#aaa",
                    fontSize: "24px"
                }}>
                    노드를 추가해보세요!
                </div>
            )}
            {/* 노드 상세/연결 팝업 */}
            {selectedNode && (
                <div style={{
                    position: "absolute",
                    top: "20px",
                    left: "20px",
                    background: "rgba(255,255,255,0.97)",
                    color: "#222",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                    border: "1px solid #ddd",
                    zIndex: 100,
                    minWidth: "320px"
                }}
                     onClick={e => e.stopPropagation()}>
                    <h3 style={{ color: "#1976d2", margin: 0, marginBottom: "12px" }}>노드: {selectedNode.id}</h3>
                    {/* 태그 표시 */}
                    {selectedNode.tags && selectedNode.tags.length > 0 && (
                        <div style={{ marginBottom: "8px", display: "flex", flexWrap: "wrap", gap: "6px" }}>
                            {selectedNode.tags.map(tag => (
                                <span key={tag} style={{ background: "#f1f1f1", borderRadius: "12px", padding: "2px 10px", fontSize: "13px", color: "#1976d2" }}>
                  #{tag}
                </span>
                            ))}
                        </div>
                    )}
                    {/* 노트 내용 영역 */}
                    <div style={{ margin: "8px 0", minHeight: "40px" }}>
                        {editMode ? (
                            <>
                <textarea
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    rows={5}
                    style={{ width: "100%", resize: "vertical", marginBottom: "8px" }}
                    autoFocus
                />
                                <div style={{ display: "flex", gap: "8px" }}>
                                    <button
                                        onClick={handleSaveEdit}
                                        style={{
                                            background: "#1976d2",
                                            color: "white",
                                            border: "none",
                                            borderRadius: "6px",
                                            padding: "6px 14px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        저장
                                    </button>
                                    <button
                                        onClick={() => setEditMode(false)}
                                        style={{
                                            background: "#eee",
                                            color: "#333",
                                            border: "none",
                                            borderRadius: "6px",
                                            padding: "6px 14px",
                                            cursor: "pointer"
                                        }}
                                    >
                                        취소
                                    </button>
                                </div>
                            </>
                        ) : (
                            <div
                                style={{
                                    color: "#333",
                                    background: "#f9f9f9",
                                    borderRadius: "6px",
                                    padding: "8px",
                                    cursor: "pointer"
                                }}
                                title="클릭해서 수정"
                                onClick={handleContentClick}
                            >
                                {selectedNode.content
                                    ? selectedNode.content
                                    : <span style={{ color: "#aaa" }}>노트 내용 없음 (클릭해서 작성)</span>}
                            </div>
                        )}
                    </div>
                    <h4 style={{ margin: "12px 0 4px 0", color: "#1976d2" }}>현재 연결:</h4>
                    <ul>
                        {links
                            .filter(link => {
                                const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                                const targetId = typeof link.target === "object" ? link.target.id : link.target;
                                return sourceId === selectedNode.id || targetId === selectedNode.id;
                            })
                            .map(link => {
                                const sourceId = typeof link.source === "object" ? link.source.id : link.source;
                                const targetId = typeof link.target === "object" ? link.target.id : link.target;
                                const otherId = sourceId === selectedNode.id ? targetId : sourceId;
                                return (
                                    <li key={`${sourceId}-${targetId}`}>
                                        {sourceId} ↔ {targetId}
                                        <button onClick={() => handleRemoveLink(otherId)}>
                                            삭제
                                        </button>
                                    </li>
                                );
                            })}
                    </ul>
                    <div>
                        <input
                            type="text"
                            value={newLink}
                            onChange={e => {
                                setNewLink(e.target.value);
                                if (selectedNode && e.target.value === selectedNode.id) {
                                    setSelfLinkError("자기 자신과 연결할 수 없습니다.");
                                } else {
                                    setSelfLinkError("");
                                }
                            }}
                            placeholder="연결할 노드 ID"
                        />
                        <button onClick={handleAddLink}>연결 추가</button>
                        {selfLinkError && (
                            <div style={{ color: "red", marginTop: "6px", fontSize: "14px" }}>
                                {selfLinkError}
                            </div>
                        )}
                    </div>
                    <div style={{ marginTop: "16px" }}>
                        <button
                            onClick={handleDeleteNode}
                            style={{
                                background: "#e53935",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                padding: "8px 16px",
                                cursor: "pointer"
                            }}
                        >
                            노드 삭제
                        </button>
                    </div>
                    <button
                        onClick={() => {
                            setSelectedNode(null);
                            setEditMode(false);
                        }}
                        style={{
                            marginTop: "12px",
                            background: "#eee",
                            color: "#333",
                            border: "none",
                            borderRadius: "6px",
                            padding: "6px 16px",
                            cursor: "pointer"
                        }}
                    >
                        닫기
                    </button>
                </div>
            )}
            {/* 노드 생성(노트 작성) 팝업 */}
            {showCreatePopup && (
                <div style={{
                    position: "absolute",
                    bottom: "120px",
                    right: "40px",
                    background: "rgba(255,255,255,0.97)",
                    color: "#222",
                    padding: "24px",
                    borderRadius: "10px",
                    boxShadow: "0 4px 24px rgba(0,0,0,0.18)",
                    border: "1px solid #ddd",
                    zIndex: 200,
                    minWidth: "320px"
                }}>
                    <div style={{ fontWeight: "bold", marginBottom: "8px" }}>ID: {newNodeId}</div>
                    {/* 색상 선택 UI */}
                    <div style={{ margin: "12px 0", display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontWeight: 500 }}>색상:</span>
                        {rainbowColors.map(color => (
                            <div
                                key={color}
                                onClick={() => setSelectedColor(color)}
                                style={{
                                    width: 26, height: 26,
                                    borderRadius: "50%",
                                    background: color,
                                    border: selectedColor === color ? "3px solid #222" : "2px solid #fff",
                                    boxShadow: selectedColor === color ? "0 0 0 2px #1976d2" : "",
                                    cursor: "pointer",
                                    transition: "box-shadow 0.1s"
                                }}
                                title={color}
                            />
                        ))}
                    </div>
                    <div style={{ marginBottom: "12px" }}>
                        <div style={{ marginBottom: "6px" }}>해시태그 (Enter 또는 ,로 구분):</div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginBottom: "6px" }}>
                            {tags.map(tag => (
                                <span key={tag} style={{ background: "#e0e0e0", borderRadius: "12px", padding: "2px 10px", fontSize: "13px" }}>
                  #{tag}
                                    <button
                                        onClick={() => handleRemoveTag(tag)}
                                        style={{ marginLeft: "4px", background: "none", border: "none", color: "#888", cursor: "pointer" }}
                                        title="태그 삭제"
                                    >×</button>
                </span>
                            ))}
                            <input
                                type="text"
                                value={tagInput}
                                onChange={e => setTagInput(e.target.value)}
                                onKeyDown={handleTagInputKeyDown}
                                placeholder="#태그 입력"
                                style={{ border: "none", outline: "none", fontSize: "13px", minWidth: "60px" }}
                            />
                        </div>
                    </div>
                    <textarea
                        value={newNodeContent}
                        onChange={e => setNewNodeContent(e.target.value)}
                        placeholder="노트 내용을 입력하세요"
                        rows={5}
                        style={{ width: "100%", resize: "vertical", marginBottom: "12px" }}
                    />
                    <div style={{ display: "flex", gap: "8px" }}>
                        <button
                            onClick={handleCreateNode}
                            style={{
                                background: "#1976d2",
                                color: "white",
                                border: "none",
                                borderRadius: "6px",
                                padding: "8px 16px",
                                cursor: "pointer"
                            }}
                        >
                            작성 완료
                        </button>
                        <button
                            onClick={() => setShowCreatePopup(false)}
                            style={{
                                background: "#eee",
                                color: "#333",
                                border: "none",
                                borderRadius: "6px",
                                padding: "8px 16px",
                                cursor: "pointer"
                            }}
                        >
                            취소
                        </button>
                    </div>
                </div>
            )}
            {/* 작성 완료 알림 팝업 */}
            {showCompletePopup && (
                <div style={{
                    position: "fixed",
                    bottom: "100px",
                    right: "48px",
                    background: "#1976d2",
                    color: "white",
                    padding: "18px 32px",
                    borderRadius: "10px",
                    fontSize: "18px",
                    boxShadow: "0 2px 16px rgba(0,0,0,0.18)",
                    zIndex: 300
                }}>
                    작성이 완료되었습니다!
                </div>
            )}
            {/* 하단 우측 노드 생성 버튼 */}
            <button
                onClick={handleAddNodeButton}
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
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    padding: 0
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
